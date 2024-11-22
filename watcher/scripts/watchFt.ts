// This script can be used to seed the database manually for testing
import * as dotenv from 'dotenv';
dotenv.config();

import { FTSolanaWatcher } from '../src/watchers/FTSolanaWatcher';
import { FTEVMWatcher } from '../src/watchers/FTEVMWatcher';
import { Network } from '@wormhole-foundation/sdk-base';
import { getNetwork } from '@wormhole-foundation/wormhole-monitor-common';
import { PublicKey } from '@solana/web3.js';

const network = getNetwork();
async function watchFtSolana(network: Network, fromSlot: number, toSlot: number) {
  const watcher = new FTSolanaWatcher(network);

  // for (let currentSlot = fromSlot; currentSlot <= toSlot; currentSlot += batchSize) {
  //   const batchEndSlot = Math.min(currentSlot + batchSize - 1, toSlot);
  //   await watcher.getFtMessagesForBlocks(currentSlot, batchEndSlot);
  //   console.log(`Processed slots ${currentSlot} to ${batchEndSlot}`);
  // }

  const sigs = [
    "3gC3F2wvr5p77JXvb7szwihPUNYR79ob68vtspkbaNboULPJV1q55qvAiZSsKiXnNXEeQv3tg492dEa35wbmEPQy",
    "26Mw7dUekSQUQbPoRF8jiwTURUuvrgRvysASJ8Am7SS2MXjkSYgFMLyQPo5UwHc9fNb8jooa3G2naLyPrS3a5Qcp",
    "4kXB42Ujb67Hm28XQPuggcTu8qox8RsHANS6UBEnb74WEngSDyhHWfLqq5ftJxnA5fNBaASmhwBrnhQGMhtp7oDM",
    "5HoSzuRrXEpAyTobdcW9Nvv8qUVUM5rrQqmFrtNdaoZhQs63G8PTryiwU9BYASqvEyyGKLDc1gH9ECPjKggQX61T",
    "9NYj698U9AzBDdQAC4NxgSoCWEMF3n8X6KzfK2TSq6AKRcfzvu51aQnBas8PP6yobqJA9ip7E3mEgMuunh3ysuW",
    "3cFvuacoBULB5xFbymQvLnGsVBdnTuf8kLt6DjYL8sb7gZdk3ToPr9ZPmvtMaQGXpHW8oENvHXYDzVunB2gUHcZE",
    "4YYxJEpcpUokCStcPnbR5GNAYRwnQuHKuLvXuVwDwdct2P3v72VnfbyviQ2TTnLfhGEXDyJF3chVY6bfq3zx7yji",
    "3LJ2HJtUj7AjajvxFSkKr6skZwt9cB1JtLftBpj619PUG8Yeccow5zFYJcqTYTv6t5aHHxbcrU6mNMA5k2Yoo6zz",
    "2NqQcdZqGAmjco6Lk5npPegMEa3AZKdx11TDyix352n3GgtPHgFWvMS9p3TkpcgYbC3NWAQvxmf2cgzomsySa1bX",
    "z9VYybpvDUVJaSvpiKvPh7VfaHCuFYmugoNKSfB6ygXDbLZMnJv5Ccjjv7yY4zxXCLGtKyjD3JVPXGoxuxV9KMW",
    "21Ecs6yZARuoT4JfgAxaVCkmeNoy39f3a1db6dKfYxX8LJuPivPCFnR5i5yYssaQsDzg43f1NFXc2A8m32ghiGFr",
    "38HYorUdMRS2ocbHerM5VhxjtF83JYXT5617KMxToZhb8HzCCQ3pWUvp79oVBF5AxQUdMEDRBqSFsCuncgedY36j",
    "43wWsi2BseU4oMfj6uthnLx9FfQN9EjAy1UbYgz8QsdN3vYy9vCs6t6Gyw5a71Y2Xcaz2PaWVcJvyYTTgG27XPJi",
    "3gCkjjVw5arxWrKW8RfzM9aaWzy7Dz4RXNhe7uSZAVLeAuCCoyVFoBkw6nxyFQhxKKQkvvDLYVaPbjnMah5bt3WF",
    "4LCCZkE4oFU1hGfdGdT7SSxquFH6cv5SdWEQgF7MLNnnHjJchv9dRvQtkS6A2gybpfR9N5Vx6PV8k6tzndsdcitw",
    "2V7g7NNPJqHDy2LKXSh3rkrvFMoSJU5Z3MUEMZ8AEjV7BTv8KALT78p42AoxufdhAkct5xQQY5zH9fKB8dBiqiBj"
  ];

  const txs = await watcher.connection?.getTransactions(sigs, {
    maxSupportedTransactionVersion: 0
  });

  const slots = txs?.map(tx => tx?.slot)

  if (slots) {
    for (const slot of slots) {
      if (!slot) continue;
      await watcher.getFtMessagesForBlocks(slot, slot);
      console.log(`Processed slot ${slot}`);
    }
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

const fromSlot = 301569871;
const toSlot = 301569872;

const arbitrumFromBlock = 247028328;
const arbitrumToBlock = 247037682;

const baseFromBlock = 22069582;
const baseToBlock = 22329636;

// watchFt(network, 'Arbitrum', arbitrumFromBlock, arbitrumToBlock).then(() =>
//   console.log('Done watching ftArbitrum')
// );

// watchFt(network, 'Base', baseFromBlock, baseToBlock).then(() =>
//   console.log('Done watching ftBase')
// );

watchFtSolana(network, fromSlot, toSlot).then(() => console.log('Done watching ftSolana'));
