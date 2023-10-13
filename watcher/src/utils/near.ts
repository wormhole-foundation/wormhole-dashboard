import axios from 'axios';
import { connect } from 'near-api-js';
import { Provider } from 'near-api-js/lib/providers';
import { AXIOS_CONFIG_JSON } from '../consts';
import {
  EventLog,
  GetTransactionsByAccountIdRequestParams,
  GetTransactionsByAccountIdResponse,
  Transaction,
  WormholePublishEventLog,
} from '../types/near';
import { BlockId, BlockResult } from 'near-api-js/lib/providers/provider';
import { sleep } from '@wormhole-foundation/wormhole-monitor-common';

// The following is obtained by going to: https://explorer.near.org/accounts/contract.wormhole_crypto.near
// and watching the network tab in the browser to see where the explorer is going.
const NEAR_EXPLORER_TRANSACTION_URL =
  'https://explorer-backend-mainnet-prod-24ktefolwq-uc.a.run.app/trpc/transaction.listByAccountId';
export const NEAR_ARCHIVE_RPC = 'https://archival-rpc.mainnet.near.org';

export const getNearProvider = async (rpc: string): Promise<Provider> => {
  const connection = await connect({ nodeUrl: rpc, networkId: 'mainnet' });
  const provider = connection.connection.provider;
  return provider;
};

export async function getTimestampByBlock(
  provider: Provider,
  blockHeight: number
): Promise<number> {
  const block: BlockResult = await fetchBlockByBlockId(provider, blockHeight);
  return block.header.timestamp;
}

export async function fetchBlockByBlockId(
  provider: Provider,
  blockHeight: BlockId
): Promise<BlockResult> {
  return await provider.block({ blockId: blockHeight });
}

// This function will only return transactions in the time window.
export const getTransactionsByAccountId = async (
  accountId: string,
  batchSize: number,
  beginningTimestamp: number,
  endingTimestamp: string
): Promise<Transaction[]> => {
  const params: GetTransactionsByAccountIdRequestParams = {
    accountId,
    limit: batchSize,
    cursor: {
      timestamp: endingTimestamp,
      indexInChunk: 0,
    },
  };
  let txs: Transaction[] = [];
  let done: boolean = false;

  while (!done) {
    // using this api: https://github.com/near/near-explorer/blob/beead42ba2a91ad8d2ac3323c29b1148186eec98/backend/src/router/transaction/list.ts#L127
    // console.log(
    //   `Near explorer URL: [${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(
    //     params
    //   )}}]`
    // );
    const res = (
      (
        await axios.get(
          `${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(params)}}`,
          AXIOS_CONFIG_JSON
        )
      ).data as GetTransactionsByAccountIdResponse
    )[0];
    if ('error' in res) throw new Error(res.error.message);
    const numItems: number = res.result.data.items.length;
    const localTxs: Transaction[] = res.result.data.items
      .filter(
        (tx) => tx.status === 'success' && tx.actions.some((a) => a.kind === 'functionCall') // other actions don't generate logs
      )
      .reverse(); // return chronological order
    txs = txs.concat(localTxs);
    if (numItems < batchSize) {
      done = true;
    } else {
      params.cursor = res.result.data.cursor;
    }
    for (const tx of localTxs) {
      // console.log(`Transaction ${tx.hash} at block ${tx.blockTimestamp}`);
      if (tx.blockTimestamp * 1_000_000 >= beginningTimestamp) {
        console.log(
          `Transaction ${tx.hash} at block ${tx.blockTimestamp} is newer than beginning timestamp ${beginningTimestamp}.`
        );
        txs.push(tx);
      } else if (tx.blockTimestamp * 1_000_000 < beginningTimestamp) {
        // This transaction is older than the beginning timestamp, so we're done.
        done = true;
        break;
      }
    }
  }
  return txs;
};

export const isWormholePublishEventLog = (log: EventLog): log is WormholePublishEventLog => {
  return log.standard === 'wormhole' && log.event === 'publish';
};
