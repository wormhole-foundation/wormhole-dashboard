import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { OptimismWatcher } from '../OptimismWatcher';

jest.setTimeout(60000);

const initialOptimismBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.optimism);

test('getFinalizedBlockNumber', async () => {
  const watcher = new OptimismWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialOptimismBlock);
});

test('getMessagesForBlocks', async () => {
  const watcher = new OptimismWatcher();
  const vaasByBlock = await watcher.getMessagesForBlocks(69401778, 69401788);
  expect(vaasByBlock).toMatchObject({
    '69401778/2023-01-20T23:56:40.000Z': [],
    '69401779/2023-01-20T23:56:40.000Z': [
      '0x5d3acc9f793afcd9ff97f569167222fae548eb354b1a6a685e5775e9a3530ff6:24/000000000000000000000000e2e2d9e31d7e1cc1178fe0d1c5950f6c809816a3/0',
    ],
    '69401780/2023-01-20T23:56:40.000Z': [],
    '69401781/2023-01-20T23:56:40.000Z': [],
    '69401782/2023-01-20T23:56:40.000Z': [],
    '69401783/2023-01-20T23:56:40.000Z': [],
    '69401784/2023-01-20T23:56:40.000Z': [],
    '69401785/2023-01-20T23:56:40.000Z': [],
    '69401786/2023-01-20T23:56:40.000Z': [],
    '69401787/2023-01-20T23:56:40.000Z': [],
    '69401788/2023-01-20T23:56:40.000Z': [],
  });
});
