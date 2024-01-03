import { expect, jest, test } from '@jest/globals';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  NETWORK,
} from '@wormhole-foundation/wormhole-monitor-common';
import { PolygonWatcher } from '../PolygonWatcher';

jest.setTimeout(60000);

const initialPolygonBlock = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN[NETWORK.MAINNET].polygon
);

test('getFinalizedBlockNumber', async () => {
  const watcher = new PolygonWatcher(NETWORK.MAINNET);
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialPolygonBlock);
});
