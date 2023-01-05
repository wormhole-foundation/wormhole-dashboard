import { expect, test } from '@jest/globals';
import { CosmwasmWatcher } from '../CosmwasmWatcher';

test('getFinalizedBlockNumber(terra2)', async () => {
  const watcher = new CosmwasmWatcher('terra2');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(3181746);
});

test('getMessagesForBlocks(terra2)', async () => {
  const watcher = new CosmwasmWatcher('terra2');
  const vaasByBlock = await watcher.getMessagesForBlocks(3165191, 3165192);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z']).toBeDefined();
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z'].length).toEqual(1);
  expect(vaasByBlock['3165191/2023-01-03T12:12:54.922Z'][0]).toEqual(
    '4FF15C860D78E65AA25DC41F634E158CC4D79BBD4EB5F72C0D09A1F6AC25810C:18/a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3/651'
  );
});

test('getFinalizedBlockNumber(terra)', async () => {
  const watcher = new CosmwasmWatcher('terra');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(10980872);
});

test('getMessagesForBlocks(terra)', async () => {
  const watcher = new CosmwasmWatcher('terra');
  const vaasByBlock = await watcher.getMessagesForBlocks(10974196, 10974197);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.045Z']).toBeDefined();
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.045Z'].length).toEqual(1);
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.045Z'][0]).toEqual(
    '8A31CDE56ED3ACB7239D705949BD6C164747210A6C4C69D98756E0CF6D22C9EB:3/0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2/256813'
  );
});

test('getFinalizedBlockNumber(xpla)', async () => {
  const watcher = new CosmwasmWatcher('xpla');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(1980633);
});

test('getMessagesForBlocks(xpla)', async () => {
  const watcher = new CosmwasmWatcher('xpla');
  const vaasByBlock = await watcher.getMessagesForBlocks(1645812, 1645813);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z']).toBeDefined();
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z'].length).toEqual(1);
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z'][0]).toEqual(
    'B01268B9A4A1F502E4278E203DBFF23AADEEFDDD91542880737845A5BDF9B3E4:28/8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c/19'
  );
});

test('getFinalizedBlockNumber(injective)', async () => {
  const watcher = new CosmwasmWatcher('injective');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(23333696);
});

// The following test will be implemented when there is an official
// Injective archive node available.
test.skip('getMessagesForBlocks(injective)', async () => {
  const watcher = new CosmwasmWatcher('injective');
  // const vaasByBlock = await watcher.getMessagesForBlocks(23333696, 23333697);
  const vaasByBlock = await watcher.getMessagesForBlocks(20908590, 20908591);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z']).toBeDefined();
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z'].length).toEqual(1);
  expect(vaasByBlock['1645812/2022-12-13T22:02:58.413Z'][0]).toEqual(
    'B01268B9A4A1F502E4278E203DBFF23AADEEFDDD91542880737845A5BDF9B3E4:28/8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c/19'
  );
});
