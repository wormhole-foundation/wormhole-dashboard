import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { PolygonWatcher } from '../PolygonWatcher';

jest.setTimeout(60000);

const initialPolygonBlock = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['mainnet'].Polygon
);

test('getFinalizedBlockNumber', async () => {
  const watcher = new PolygonWatcher('mainnet');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialPolygonBlock);
});
