import { expect, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '../../consts';
import { MoonbeamWatcher } from '../MoonbeamWatcher';

const initialMoonbeamBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.moonbeam);

test('getFinalizedBlockNumber', async () => {
  const watcher = new MoonbeamWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialMoonbeamBlock);
});
