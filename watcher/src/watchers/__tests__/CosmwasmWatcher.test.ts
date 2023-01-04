import { expect, test } from '@jest/globals';
import { CosmwasmWatcher } from '../CosmwasmWatcher';

test('getFinalizedBlockNumber', async () => {
  const watcher = new CosmwasmWatcher('terra2');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(3181746);
});

test('getMessagesForBlocks', async () => {
  const watcher = new CosmwasmWatcher('terra2');
  const vaasByBlock = await watcher.getMessagesForBlocks(3165191, 3165192);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z']).toBeDefined();
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z'].length).toEqual(1);
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z'][0]).toEqual(
    '4FF15C860D78E65AA25DC41F634E158CC4D79BBD4EB5F72C0D09A1F6AC25810C:18/a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3/651'
  );
});
