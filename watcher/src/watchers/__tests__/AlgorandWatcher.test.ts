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
  expect(messages).toMatchObject({ '25692450/2022-12-21T02:00:40.000Z': [] });
});

test('getMessagesForBlocks seq > 383', async () => {
  const watcher = new AlgorandWatcher();
  const messages = await watcher.getMessagesForBlocks(26856742, 26856742);
  expect(messages).toMatchObject({
    '26856742/2023-02-09T09:05:04.000Z': [
      'LJNYXPG5VLJNNTBLSZSHLZQ7XQWTSUPKGA7APVI53J3MAKHQN72Q:8/67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45/384',
    ],
  });
});

test('getMessagesForBlocks on known empty block', async () => {
  const watcher = new AlgorandWatcher();
  const messages = await watcher.getMessagesForBlocks(23761195, 23761195);
  expect(Object.keys(messages).length).toEqual(1);
});
