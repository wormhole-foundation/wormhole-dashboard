import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { connect } from 'near-api-js';
import { Provider } from 'near-api-js/lib/providers';
import { BlockResult } from 'near-api-js/lib/providers/provider';
import { initDb } from '../src/databases/utils';
import {
  NearExplorerTransactionRequestParams,
  NearExplorerTransactionResponse,
} from '../src/types/near';
import { NearWatcher } from '../src/watchers/NearWatcher';

// This script exists because NEAR RPC nodes do not support querying blocks older than 5 epochs
// (~2.5 days): https://docs.near.org/api/rpc/setup#querying-historical-data. This script fetches
// all transactions for the core bridge contract from the NEAR Explorer backend API and then uses
// the archival RPC node to backfill messages in the given range.
//
// Ensure `DB_SOURCE` and Bigtable environment variables are set to backfill Bigtable database.
// Otherwise, the script will backfill the local JSON database.

const BATCH_SIZE = 1000;
const NEAR_ARCHIVE_RPC = 'https://archival-rpc.mainnet.near.org';
const NEAR_EXPLORER_TRANSACTION_URL =
  'https://backend-mainnet-1713.onrender.com/trpc/transaction.listByAccountId';

const getArchivalRpcProvider = async (): Promise<Provider> => {
  const connection = await connect({ nodeUrl: NEAR_ARCHIVE_RPC, networkId: 'mainnet' });
  const provider = connection.connection.provider;

  // sleep for 100ms between each request (do not parallelize calls with Promise.all)
  for (const propName of Object.getOwnPropertyNames(Object.getPrototypeOf(provider))) {
    if (typeof (provider as any)[propName] === 'function') {
      (provider as any)[propName] = async (...args: any[]) => {
        await sleep(100); // respect rate limits: 600req/min
        return (provider as any)[propName](...args);
      };
    }
  }

  return provider;
};

const getExplorerTransactionsUrl = (timestamp: number, batchSize: number): string => {
  const params: NearExplorerTransactionRequestParams = {
    accountId: CONTRACTS.MAINNET.near.core,
    limit: batchSize,
    cursor: {
      timestamp,
      indexInChunk: 0,
    },
  };
  return `${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(params)}}`;
};

(async () => {
  const db = initDb();
  const watcher = new NearWatcher();
  const provider = await getArchivalRpcProvider();
  const fromBlock = Number(
    (await db.getLastBlockByChain(watcher.chain)) ??
      INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[watcher.chain] ??
      0
  );

  // fetch all transactions for core bridge contract from explorer:
  // https://github.com/near/near-explorer/blob/beead42ba2a91ad8d2ac3323c29b1148186eec98/backend/src/router/transaction/list.ts#L127
  const toBlock = await provider.block({ finality: 'final' });
  const transactions = (
    (await axios.get(getExplorerTransactionsUrl(toBlock.header.timestamp, BATCH_SIZE)))
      .data as NearExplorerTransactionResponse
  )[0].result.data.items.filter((tx) => tx.status === 'success');

  // filter out transactions that are not in the given block range
  const blocks: BlockResult[] = [];
  const blockHashes = [...new Set(transactions.map((tx) => tx.blockHash))];
  blockHashes.forEach(async (hash) => {
    const block = await provider.block(hash);
    if (block.header.height >= fromBlock && block.header.height <= toBlock.header.height) {
      blocks.push(block);
    }
  });

  watcher.provider = provider;
  const vaasByBlock = await watcher.getMessagesFromBlockResults(blocks);
  await db.storeVaasByBlock(watcher.chain, vaasByBlock);
})();
