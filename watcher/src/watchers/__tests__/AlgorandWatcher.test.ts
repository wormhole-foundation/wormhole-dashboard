import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { AlgorandWatcher } from '../AlgorandWatcher';

jest.setTimeout(60000);

const initialAlgorandBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.algorand);

test('getFinalizedBlockNumber', async () => {
  const watcher = new AlgorandWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialAlgorandBlock);
});

test('getMessagesForBlocks', async () => {
  const watcher = new AlgorandWatcher();
  const messages = await watcher.getMessagesForBlocks(25692450, 25692450);
  expect(Object.keys(messages).length).toEqual(1);
});

test('getMessagesForBlocks on known empty block', async () => {
  const watcher = new AlgorandWatcher();
  const messages = await watcher.getMessagesForBlocks(23761195, 23761195);
  expect(Object.keys(messages).length).toEqual(1);
});
