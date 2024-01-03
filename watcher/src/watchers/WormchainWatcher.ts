import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import axios from 'axios';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { CosmwasmBlockResult, CosmwasmWatcher } from './CosmwasmWatcher';
import { NETWORK } from '@wormhole-foundation/wormhole-monitor-common';

export class WormchainWatcher extends CosmwasmWatcher {
  latestBlockTag: string;
  getBlockTag: string;
  hashTag: string;
  rpc: string | undefined;
  latestBlockHeight: number;

  constructor(network: NETWORK) {
    super(network, 'wormchain');
    this.rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!this.rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    this.latestBlockTag = 'abci_info';
    this.getBlockTag = 'block?height=';
    this.hashTag = 'tx?hash=0x';
    this.latestBlockHeight = 0;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    const result = (await axios.get(`${this.rpc}/${this.latestBlockTag}`, AXIOS_CONFIG_JSON)).data;
    if (result?.result?.response?.last_block_height) {
      let blockHeight: number = parseInt(result.result.response.last_block_height);
      if (blockHeight !== this.latestBlockHeight) {
        this.latestBlockHeight = blockHeight;
        this.logger.debug('blockHeight = ' + blockHeight);
      }
      return blockHeight;
    }
    throw new Error(`Unable to parse result of ${this.latestBlockTag} on ${this.rpc}`);
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    const address = CONTRACTS.MAINNET[this.chain].core;
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    this.logger.debug(`core contract for ${this.chain} is ${address}`);
    let vaasByBlock: VaasByBlock = {};
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);

    // For each block number, call {RPC}/{getBlockTag}/{block_number}
    // Foreach block.data.txs[] do hexToHash() to get the txHash
    // Then call {RPC}/{hashTag}/{hash} to get the logs/events
    // Walk the logs/events

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      this.logger.debug('Getting block number ' + blockNumber);
      const blockResult: CosmwasmBlockResult = (
        await axios.get(`${this.rpc}/${this.getBlockTag}${blockNumber}`, AXIOS_CONFIG_JSON)
      ).data?.result;
      if (!blockResult || !blockResult.block.data) {
        throw new Error('bad result for block ${blockNumber}');
      }
      const blockKey = makeBlockKey(
        blockNumber.toString(),
        new Date(blockResult.block.header.time).toISOString()
      );
      vaasByBlock[blockKey] = [];
      let vaaKey: string = '';
      let numTxs: number = 0;
      if (blockResult.block.data.txs) {
        numTxs = blockResult.block.data.txs.length;
      }
      for (let i = 0; i < numTxs; i++) {
        // The following check is not needed because of the check for numTxs.
        // But typescript wanted it anyway.
        if (!blockResult.block.data.txs) {
          continue;
        }
        let hash: string = this.hexToHash(blockResult.block.data.txs[i]);
        this.logger.debug('blockNumber = ' + blockNumber + ', txHash[' + i + '] = ' + hash);
        // console.log('Attempting to get hash', `${this.rpc}/${this.hashTag}${hash}`);
        try {
          const hashResult: CosmwasmHashResult = (
            await axios.get(`${this.rpc}/${this.hashTag}${hash}`, AXIOS_CONFIG_JSON)
          ).data?.result;
          if (hashResult && hashResult.tx_result.events) {
            const numEvents = hashResult.tx_result.events.length;
            for (let j = 0; j < numEvents; j++) {
              let type: string = hashResult.tx_result.events[j].type;
              if (type === 'wasm') {
                if (hashResult.tx_result.events[j].attributes) {
                  let attrs = hashResult.tx_result.events[j].attributes;
                  let emitter: string = '';
                  let sequence: string = '';
                  let coreContract: boolean = false;
                  // only care about _contract_address, message.sender and message.sequence
                  const numAttrs = attrs.length;
                  for (let k = 0; k < numAttrs; k++) {
                    const key = Buffer.from(attrs[k].key, 'base64').toString().toLowerCase();
                    this.logger.debug('Encoded Key = ' + attrs[k].key + ', decoded = ' + key);
                    if (key === 'message.sender') {
                      emitter = Buffer.from(attrs[k].value, 'base64').toString();
                    } else if (key === 'message.sequence') {
                      sequence = Buffer.from(attrs[k].value, 'base64').toString();
                    } else if (key === '_contract_address' || key === 'contract_address') {
                      let addr = Buffer.from(attrs[k].value, 'base64').toString();
                      if (addr === address) {
                        coreContract = true;
                      }
                    }
                  }
                  if (coreContract && emitter !== '' && sequence !== '') {
                    vaaKey = makeVaaKey(hash, this.chain, emitter, sequence);
                    this.logger.debug('blockKey: ' + blockKey);
                    this.logger.debug('Making vaaKey: ' + vaaKey);
                    vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
                  }
                }
              }
            }
          } else {
            this.logger.error('There were no hashResults');
          }
        } catch (e: any) {
          // console.error(e);
          if (
            e?.response?.status === 500 &&
            e?.response?.data?.code === 2 &&
            e?.response?.data?.message.startsWith('json: error calling MarshalJSON')
          ) {
            // Just skip this one...
          } else {
            // Rethrow the error because we only want to catch the above error
            throw e;
          }
        }
      }
    }
    return vaasByBlock;
  }
}

export type CosmwasmHashResult = {
  tx: {
    body: {
      messages: string[];
      memo: string;
      timeout_height: string;
      extension_options: [];
      non_critical_extension_options: [];
    };
    auth_info: {
      signer_infos: string[];
      fee: {
        amount: [{ denom: string; amount: string }];
        gas_limit: string;
        payer: string;
        granter: string;
      };
    };
    signatures: string[];
  };
  tx_result: {
    height: string;
    txhash: string;
    codespace: string;
    code: 0;
    data: string;
    raw_log: string;
    logs: [{ msg_index: number; log: string; events: EventsType }];
    info: string;
    gas_wanted: string;
    gas_used: string;
    tx: {
      '@type': '/cosmos.tx.v1beta1.Tx';
      body: {
        messages: [
          {
            '@type': '/cosmos.staking.v1beta1.MsgBeginRedelegate';
            delegator_address: string;
            validator_src_address: string;
            validator_dst_address: string;
            amount: { denom: string; amount: string };
          }
        ];
        memo: '';
        timeout_height: '0';
        extension_options: [];
        non_critical_extension_options: [];
      };
      auth_info: {
        signer_infos: [
          {
            public_key: {
              '@type': '/cosmos.crypto.secp256k1.PubKey';
              key: string;
            };
            mode_info: { single: { mode: string } };
            sequence: string;
          }
        ];
        fee: {
          amount: [{ denom: string; amount: string }];
          gas_limit: string;
          payer: string;
          granter: string;
        };
      };
      signatures: string[];
    };
    timestamp: string; // eg. '2023-01-03T12:12:54Z'
    events: EventsType[];
  };
};

type EventsType = {
  type: string;
  attributes: [
    {
      key: string;
      value: string;
      index: boolean;
    }
  ];
};
