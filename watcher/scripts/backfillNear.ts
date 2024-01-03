import * as dotenv from 'dotenv';
dotenv.config();
import { ChainName, CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { BlockResult, Provider } from 'near-api-js/lib/providers/provider';
import ora from 'ora';
import { initDb, makeBlockKey } from '../src/databases/utils';
import {
  getNearProvider,
  getTimestampByBlock,
  getTransactionsByAccountId,
  NEAR_ARCHIVE_RPC,
} from '../src/utils/near';
import { getMessagesFromBlockResults } from '../src/watchers/NearWatcher';
import { Transaction } from '../src/types/near';
import { VaasByBlock } from '../src/databases/types';
import { getNetworkFromEnv } from '../src/utils/environment';

// This script exists because NEAR RPC nodes do not support querying blocks older than 5 epochs
// (~2.5 days): https://docs.near.org/api/rpc/setup#querying-historical-data. This script fetches
// all transactions for the core bridge contract from the NEAR Explorer backend API and then uses
// the archival RPC node to backfill messages in the given range.
//
// Ensure `DB_SOURCE` and Bigtable environment variables are set to backfill Bigtable database.
// Otherwise, the script will backfill the local JSON database.

const BATCH_SIZE = 100;

(async () => {
  const db = initDb(false); // Don't start watching
  const network = getNetworkFromEnv();
  const chain: ChainName = 'near';
  const provider = await getNearProvider(network, NEAR_ARCHIVE_RPC);
  const fromBlock = Number(
    (await db.getLastBlockByChain(chain)) ??
      INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN[network][chain] ??
      0
  );
  const fromBlockTimestamp: number = await getTimestampByBlock(provider, fromBlock);
  console.log(`Last block seen: ${fromBlock} at ${fromBlockTimestamp}`);

  // fetch all transactions for core bridge contract from explorer
  let log = ora('Fetching transactions from NEAR Explorer...').start();
  const toBlock = await provider.block({ finality: 'final' });
  console.log('\ntoBlock', toBlock.header.height, toBlock.header.timestamp.toString());
  const transactions: Transaction[] = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    BATCH_SIZE,
    fromBlockTimestamp,
    toBlock.header.timestamp.toString().padEnd(19, '9') // pad to nanoseconds
  );
  log.succeed(`Fetched ${transactions.length} transactions from NEAR Explorer`);

  // filter out transactions that precede last seen block
  const blocks: BlockResult[] = [];
  const blockHashes = [...new Set(transactions.map((tx) => tx.blockHash))]; // de-dup blocks
  log = ora('Fetching blocks...').start();
  for (let i = 0; i < blockHashes.length; i++) {
    log.text = `Fetching blocks... ${i + 1}/${blockHashes.length}`;
    let success: boolean = false;
    while (!success) {
      try {
        const block = await provider.block({ blockId: blockHashes[i] });
        if (block.header.height > fromBlock && block.header.height <= toBlock.header.height) {
          blocks.push(block);
        }
        success = true;
      } catch (e) {
        console.error('Error fetching block', e);
        await sleep(5000);
      }
    }
  }

  log.succeed(`Fetched ${blocks.length} blocks`);
  const vaasByBlock: VaasByBlock = await getMessagesFromBlockResults(provider, blocks, true);
  // Make a block for the to_block, if it isn't already there
  const blockKey = makeBlockKey(
    toBlock.header.height.toString(),
    new Date(toBlock.header.timestamp / 1_000_000).toISOString()
  );
  if (!vaasByBlock[blockKey]) {
    vaasByBlock[blockKey] = [];
  }
  await db.storeVaasByBlock(chain, vaasByBlock);
  log.succeed('Uploaded messages to db successfully');
})();
