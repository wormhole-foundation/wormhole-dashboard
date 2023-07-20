import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { EVMWatcher } from '../EVMWatcher';

jest.setTimeout(60000);

const initialBaseBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.base);

test('getFinalizedBlockNumber', async () => {
  const watcher = new EVMWatcher('base');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  console.log('blockNumber', blockNumber);
  expect(blockNumber).toBeGreaterThan(initialBaseBlock);
});

test('getMessagesForBlocks', async () => {
  const watcher = new EVMWatcher('base');
  const vaasByBlock = await watcher.getMessagesForBlocks(1544175, 1544185);
  expect(vaasByBlock).toMatchObject({
    '1544175/2023-07-20T18:28:17.000Z': [],
    '1544176/2023-07-20T18:28:19.000Z': [],
    '1544177/2023-07-20T18:28:21.000Z': [],
    '1544178/2023-07-20T18:28:23.000Z': [],
    '1544179/2023-07-20T18:28:25.000Z': [],
    '1544180/2023-07-20T18:28:27.000Z': [],
    '1544181/2023-07-20T18:28:29.000Z': [],
    '1544182/2023-07-20T18:28:31.000Z': [],
    '1544183/2023-07-20T18:28:33.000Z': [],
    '1544184/2023-07-20T18:28:35.000Z': [],
    '1544185/2023-07-20T18:28:37.000Z': [],
  });
});
