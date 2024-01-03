import { expect, jest, test } from '@jest/globals';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  NETWORK,
} from '@wormhole-foundation/wormhole-monitor-common';
import { MoonbeamWatcher } from '../MoonbeamWatcher';

jest.setTimeout(60000);

const initialMoonbeamBlock = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN[NETWORK.MAINNET].moonbeam
);

test('getFinalizedBlockNumber', async () => {
  const watcher = new MoonbeamWatcher(NETWORK.MAINNET);
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialMoonbeamBlock);
});
