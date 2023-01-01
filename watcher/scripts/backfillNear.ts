import { ChainName, CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { BlockResult } from 'near-api-js/lib/providers/provider';
import { initDb } from '../src/databases/utils';
import { getArchivalRpcProvider, getTransactionsByAccountId } from '../src/utils/near';
import { getMessagesFromBlockResults } from '../src/watchers/NearWatcher';

// This script exists because NEAR RPC nodes do not support querying blocks older than 5 epochs
// (~2.5 days): https://docs.near.org/api/rpc/setup#querying-historical-data. This script fetches
// all transactions for the core bridge contract from the NEAR Explorer backend API and then uses
// the archival RPC node to backfill messages in the given range.
//
// Ensure `DB_SOURCE` and Bigtable environment variables are set to backfill Bigtable database.
// Otherwise, the script will backfill the local JSON database.

const BATCH_SIZE = 1000;

(async () => {
  const db = initDb();
  const chain: ChainName = 'near';
  const provider = await getArchivalRpcProvider();
  const fromBlock = Number(
    (await db.getLastBlockByChain(chain)) ?? INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain] ?? 0
  );

  // fetch all transactions for core bridge contract from explorer
  const toBlock = await provider.block({ finality: 'final' });
  const transactions = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    BATCH_SIZE,
    toBlock.header.timestamp.toString()
  );

  // filter out transactions that precede last seen block
  const blocks: BlockResult[] = [];
  const blockHashes = [...new Set(transactions.map((tx) => tx.blockHash))];
  blockHashes.forEach(async (hash) => {
    const block = await provider.block(hash);
    if (block.header.height >= fromBlock && block.header.height <= toBlock.header.height) {
      blocks.push(block);
    }
  });

  const vaasByBlock = await getMessagesFromBlockResults(provider, blocks);
  await db.storeVaasByBlock(chain, vaasByBlock);
})();
