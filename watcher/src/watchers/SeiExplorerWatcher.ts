import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import axios from 'axios';
import { AXIOS_CONFIG_JSON, SEI_GRAPHQL } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { CosmwasmHashResult, CosmwasmWatcher } from './CosmwasmWatcher';
import { sleep } from '@wormhole-foundation/wormhole-monitor-common';

type SeiExplorerAccountTransactionsResponse = {
  data: {
    account_transactions: {
      block: { height: number; timestamp: string };
      transaction: {
        account: { address: string };
        hash: string;
        success: boolean;
        messages: any[];
        is_ibc: boolean;
      };
    }[];
  };
};

export class SeiExplorerWatcher extends CosmwasmWatcher {
  constructor() {
    super('sei');
    // arbitrarily large since the code here is capable of pulling all logs from all via indexer pagination
    this.maximumBatchSize = 1_000_000;
  }

  makeGraphQLQuery(offset: number, pageSize: number) {
    return {
      query:
        'query getTxsByAddressPagination($expression: account_transactions_bool_exp, $offset: Int!, $pageSize: Int!) {\n  account_transactions(\n    where: $expression\n    order_by: {block_height: desc}\n    offset: $offset\n    limit: $pageSize\n  ) {\n    block {\n      height\n      timestamp\n    }\n    transaction {\n      account {\n        address\n      }\n      hash\n      success\n      messages\n      is_clear_admin\n      is_execute\n      is_ibc\n      is_instantiate\n      is_migrate\n      is_send\n      is_store_code\n      is_update_admin\n    }\n    is_signer\n  }\n}',
      variables: { expression: { account_id: { _eq: 42 } }, offset, pageSize },
      operationName: 'getTxsByAddressPagination',
    };
  }

  // retrieve blocks for core contract
  // compare block height with what is passed in
  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    const address = CONTRACTS.MAINNET[this.chain].core;
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    this.logger.debug(`core contract for ${this.chain} is ${address}`);
    let vaasByBlock: VaasByBlock = {};
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);

    const limit: number = 50;
    let done: boolean = false;
    let skip: number = 0;
    while (!done) {
      const query = this.makeGraphQLQuery(skip, limit);
      this.logger.debug(`Query string = ${JSON.stringify(query)}`);
      const bulkTxnResult = (
        await axios.post<SeiExplorerAccountTransactionsResponse>(
          SEI_GRAPHQL,
          query,
          AXIOS_CONFIG_JSON
        )
      ).data;
      if (!bulkTxnResult?.data?.account_transactions) {
        throw new Error('bad bulkTxnResult');
      }
      skip += bulkTxnResult.data.account_transactions.length;
      const bulkTxns = bulkTxnResult.data.account_transactions;
      if (bulkTxns.length === 0) {
        throw new Error('No transactions');
      }
      for (let i: number = 0; i < bulkTxns.length; ++i) {
        // Walk the transactions
        const txn = bulkTxns[i];
        const height: number = txn.block.height;
        const hash = txn.transaction.hash.replace('\\x', '').toUpperCase();
        this.logger.debug(`Found one: ${fromBlock}, ${height}, ${toBlock}, ${hash}`);
        if (height >= fromBlock && height <= toBlock && txn.transaction.is_ibc) {
          // We only care about the transactions in the given block range
          // Sei uses IBC message emission
          const blockKey = makeBlockKey(
            txn.block.height.toString(),
            new Date(`${txn.block.timestamp}Z`).toISOString()
          );
          // Now get the logs for that transaction...
          // This is straight from CosmwasmWatcher, could probably optimize
          try {
            await sleep(500); // don't make the RPC upset
            const hashResult: CosmwasmHashResult = (
              await axios.get(`${this.rpc}/${this.hashTag}${hash}`, AXIOS_CONFIG_JSON)
            ).data;
            if (hashResult && hashResult.tx_response.events) {
              const numEvents = hashResult.tx_response.events.length;
              for (let j = 0; j < numEvents; j++) {
                let type: string = hashResult.tx_response.events[j].type;
                if (type === 'wasm') {
                  if (hashResult.tx_response.events[j].attributes) {
                    let attrs = hashResult.tx_response.events[j].attributes;
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
                      const vaaKey = makeVaaKey(hash, this.chain, emitter, sequence);
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
    // NOTE: this does not set an empty entry for the latest block since we don't know if the graphql response
    // is synced with the block height. Therefore, the latest block will only update when a new transaction appears.
    return vaasByBlock;
  }
}
