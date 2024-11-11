// This script can be used to seed the database manually for testing
import * as dotenv from 'dotenv';
dotenv.config();

import { FTSolanaWatcher } from '../src/watchers/FTSolanaWatcher';
import { FTEVMWatcher } from '../src/watchers/FTEVMWatcher';
import { Network } from '@wormhole-foundation/sdk-base';
import { getNetwork } from '@wormhole-foundation/wormhole-monitor-common';

const network = getNetwork();
async function watchFtSolana(network: Network, fromSlot: number, toSlot: number) {
  const watcher = new FTSolanaWatcher(network);
  const batchSize = 1000;

  for (let currentSlot = fromSlot; currentSlot <= toSlot; currentSlot += batchSize) {
    const batchEndSlot = Math.min(currentSlot + batchSize - 1, toSlot);
    await watcher.getFtMessagesForBlocks(currentSlot, batchEndSlot);
    console.log(`Processed slots ${currentSlot} to ${batchEndSlot}`);
  }
}

async function watchFt(
  network: Network,
  chain: 'Arbitrum' | 'Base',
  fromBlock: number,
  toBlock: number
) {
  const watcher = new FTEVMWatcher(network, chain);
  const batchSize = 1000;

  for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += batchSize) {
    const batchEndBlock = Math.min(currentBlock + batchSize - 1, toBlock);
    await watcher.getFtMessagesForBlocks(currentBlock, batchEndBlock);
    console.log(`Processed blocks ${currentBlock} to ${batchEndBlock}`);
  }
}

const fromSlot = 300257524;
const toSlot = 300257525;

const arbitrumFromBlock = 247028328;
const arbitrumToBlock = 247037682;

const baseFromBlock = 18820795;
const baseToBlock = 18958996;

// watchFt(network, 'Arbitrum', arbitrumFromBlock, arbitrumToBlock).then(() =>
//   console.log('Done watching ftArbitrum')
// );

// watchFt(network, 'Base', baseFromBlock, baseToBlock).then(() =>
//   console.log('Done watching ftBase')
// );

watchFtSolana(network, fromSlot, toSlot).then(() => console.log('Done watching ftSolana'));
