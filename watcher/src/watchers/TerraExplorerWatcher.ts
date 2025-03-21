import axios from 'axios';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Watcher } from './Watcher';
import { Network, PlatformToChains, contracts } from '@wormhole-foundation/sdk-base';

export class TerraExplorerWatcher extends Watcher {
  // Arbitrarily large since the code here is capable of pulling all logs from all via indexer pagination
  maximumBatchSize: number = 100000;

  latestBlockTag: string;
  getBlockTag: string;
  allTxsTag: string;
  rpc: string | undefined;
  latestBlockHeight: number;

  constructor(network: Network, chain: PlatformToChains<'Cosmwasm'>) {
    super(network, chain, 'vaa');
    this.rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!this.rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    this.latestBlockTag = 'v1/blocks/latest';
    this.getBlockTag = 'v1/blocks/';
    this.allTxsTag = 'v1/txs?';
    this.latestBlockHeight = 0;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    const result = (await axios.get(`${this.rpc}/${this.latestBlockTag}`, AXIOS_CONFIG_JSON)).data;
    if (result && result.height) {
      let blockHeight: number = parseInt(result.height);
      if (blockHeight !== this.latestBlockHeight) {
        this.latestBlockHeight = blockHeight;
        this.logger.debug('blockHeight = ' + blockHeight);
      }
      return blockHeight;
    }
    throw new Error(`Unable to parse result of ${this.latestBlockTag} on ${this.rpc}`);
  }

  // retrieve blocks for core contract.
  // use "next": as the pagination key
  // compare block height ("height":) with what is passed in.
  async getMessagesForBlocks(
    fromBlock: number,
    toBlock: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    const address = contracts.coreBridge.get(this.network, this.chain);
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    this.logger.debug(`core contract for ${this.chain} is ${address}`);
    let vaasByBlock: VaasByBlock = {};
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);

    const limit: number = 100;
    let done: boolean = false;
    let offset: number = 0;
    let lastBlockInserted: number = 0;
    while (!done) {
      // This URL gets the paginated list of transactions for the core contract
      let url: string = `${this.rpc}/${this.allTxsTag}offset=${offset}&limit=${limit}&account=${address}`;
      this.logger.debug(`Query string = ${url}`);
      const bulkTxnResult: BulkTxnResult = (
        await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Encoding': 'application/json',
          },
        })
      ).data;
      if (!bulkTxnResult) {
        throw new Error('bad bulkTxnResult');
      }
      offset = bulkTxnResult.next;
      const bulkTxns: BulkTxn[] = bulkTxnResult.txs;
      if (!bulkTxns) {
        throw new Error('No transactions');
      }
      for (let i: number = 0; i < bulkTxns.length; ++i) {
        // Walk the transactions
        const txn: BulkTxn = bulkTxns[i];
        const height: number = parseInt(txn.height);
        if (height >= fromBlock && height <= toBlock) {
          // We only care about the transactions in the given block range
          this.logger.debug(`Found one: ${fromBlock}, ${height}, ${toBlock}`);
          const blockKey = makeBlockKey(txn.height, new Date(txn.timestamp).toISOString());
          vaasByBlock[blockKey] = [];
          lastBlockInserted = height;
          this.logger.debug(`lastBlockInserted = ${lastBlockInserted}`);
          let vaaKey: string = '';
          // Each txn has an array of raw_logs
          const rawLogs: RawLogEvents[] = JSON.parse(txn.raw_log);
          for (let j: number = 0; j < rawLogs.length; ++j) {
            const rawLog: RawLogEvents = rawLogs[j];
            const events: EventObjectsTypes[] = rawLog.events;
            if (!events) {
              this.logger.debug(
                `No events in rawLog${j} for block ${height}, hash = ${txn.txhash}`
              );
              continue;
            }
            for (let k: number = 0; k < events.length; k++) {
              const event: EventObjectsTypes = events[k];
              if (event.type === 'wasm') {
                if (event.attributes) {
                  let attrs = event.attributes;
                  let emitter: string = '';
                  let sequence: string = '';
                  let coreContract: boolean = false;
                  // only care about _contract_address, message.sender and message.sequence
                  const numAttrs = attrs.length;
                  for (let l = 0; l < numAttrs; l++) {
                    const key = attrs[l].key;
                    if (key === 'message.sender') {
                      emitter = attrs[l].value;
                    } else if (key === 'message.sequence') {
                      sequence = attrs[l].value;
                    } else if (key === '_contract_address' || key === 'contract_address') {
                      let addr = attrs[l].value;
                      if (addr === address) {
                        coreContract = true;
                      }
                    }
                  }
                  if (coreContract && emitter !== '' && sequence !== '') {
                    vaaKey = makeVaaKey(txn.txhash, this.chain, emitter, sequence);
                    this.logger.debug('blockKey: ' + blockKey);
                    this.logger.debug('Making vaaKey: ' + vaaKey);
                    vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
                  }
                }
              }
            }
          }
        }
        if (height < fromBlock) {
          this.logger.debug('Breaking out due to height < fromBlock');
          done = true;
          break;
        }
      }
      if (bulkTxns.length < limit) {
        this.logger.debug('Breaking out due to ran out of txns.');
        done = true;
      }
    }
    if (lastBlockInserted < toBlock) {
      // Need to create something for the last requested block because it will
      // become the new starting point for subsequent calls.
      this.logger.debug(`Adding filler for block ${toBlock}`);
      const blkUrl = `${this.rpc}/${this.getBlockTag}${toBlock}`;
      const result: NewCosmwasmBlockResult = (await axios.get(blkUrl, AXIOS_CONFIG_JSON)).data;
      if (!result) {
        throw new Error(`Unable to get block information for block ${toBlock}`);
      }
      const blockKey = makeBlockKey(
        result.height.toString(),
        new Date(result.timestamp).toISOString()
      );
      vaasByBlock[blockKey] = [];
    }
    return { vaasByBlock };
  }
}

type BulkTxnResult = {
  next: number; //400123609;
  limit: number; //10;
  txs: BulkTxn[];
};

type BulkTxn = {
  id: number; //400300689;
  chainId: string; //'columbus-5';
  tx: [Object];
  logs: [];
  height: string; //'11861053';
  txhash: string; //'31C82DC3432B4824B5195AA572A8963BA6147CAFD3ADAC6C5250BF447FA5D206';
  raw_log: string;
  gas_used: string; //'510455';
  timestamp: string; //'2023-03-10T12:18:05Z';
  gas_wanted: string; //'869573';
};

export type RawLogEvents = {
  msg_index?: number;
  events: EventObjectsTypes[];
};

export type EventObjectsTypes = {
  type: string;
  attributes: Attribute[];
};

type Attribute = {
  key: string;
  value: string;
};

type CosmwasmBlockResult = {
  block_id: {
    hash: string;
    parts: {
      total: number;
      hash: string;
    };
  };
  block: {
    header: {
      version: { block: string };
      chain_id: string;
      height: string;
      time: string; // eg. '2023-01-03T12:13:00.849094631Z'
      last_block_id: { hash: string; parts: { total: number; hash: string } };
      last_commit_hash: string;
      data_hash: string;
      validators_hash: string;
      next_validators_hash: string;
      consensus_hash: string;
      app_hash: string;
      last_results_hash: string;
      evidence_hash: string;
      proposer_address: string;
    };
    data: { txs: string[] | null };
    evidence: { evidence: null };
    last_commit: {
      height: string;
      round: number;
      block_id: { hash: string; parts: { total: number; hash: string } };
      signatures: string[];
    };
  };
};

type NewCosmwasmBlockResult = {
  chainId: string; //'columbus-5';
  height: number; //14520709;
  timestamp: string; //'2023-09-13T13:38:23.081Z';
  proposer: {
    moniker: string; //'ISS';
    identity: string; //'';
    operatorAddress: string; //'terravaloper15khv8dsaxqmf7nwu4jdlp9slxl7aczte3x068c';
  };
  txs: [
    {
      id: number;
      tx: Object;
      logs: Object[];
      height: string;
      txhash: string;
      raw_log: string;
      gas_used: string;
      timestamp: string;
      gas_wanted: string;
    }
  ];
};
