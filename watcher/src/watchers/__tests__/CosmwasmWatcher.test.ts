import { expect, jest, test } from '@jest/globals';
import { CosmwasmWatcher } from '../CosmwasmWatcher';
import { TerraExplorerWatcher } from '../TerraExplorerWatcher';
import { InjectiveExplorerWatcher } from '../InjectiveExplorerWatcher';
import { SeiExplorerWatcher } from '../SeiExplorerWatcher';
import { WormchainWatcher } from '../WormchainWatcher';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';

jest.setTimeout(60000);

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

test('getMessagesForBlocks(terra2)', async () => {
  const watcher = new CosmwasmWatcher('terra2');
  const vaasByBlock = await watcher.getMessagesForBlocks(5635710, 5635712);
  const entries = Object.entries(vaasByBlock);
  console.log(entries);
  expect(entries.length).toEqual(3);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(3);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['5635710/2023-06-23T12:54:10.949Z']).toBeDefined();
  expect(vaasByBlock['5635711/2023-06-23T12:54:16.979Z']).toBeDefined();
  expect(vaasByBlock['5635712/2023-06-23T12:54:23.010Z']).toBeDefined();
});

test.skip('getFinalizedBlockNumber(terra)', async () => {
  const watcher = new CosmwasmWatcher('terra');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(10980872);
});

// flaky rpc, skip
test.skip('getMessagesForBlocks(terra)', async () => {
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

test('getFinalizedBlockNumber(terra explorer)', async () => {
  const watcher = new TerraExplorerWatcher('terra');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(10980872);
});

// flaky rpc, skip
test.skip('getMessagesForBlocks(terra explorer)', async () => {
  const watcher = new TerraExplorerWatcher('terra');
  const vaasByBlock = await watcher.getMessagesForBlocks(10974196, 10974197);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.000Z']).toBeDefined();
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.000Z'].length).toEqual(1);
  expect(vaasByBlock['10974196/2023-01-06T04:23:21.000Z'][0]).toEqual(
    '8A31CDE56ED3ACB7239D705949BD6C164747210A6C4C69D98756E0CF6D22C9EB:3/0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2/256813'
  );
});

// flaky rpc, skip
test.skip('getMessagesForBlocks(terra explorer, no useful info)', async () => {
  const watcher = new TerraExplorerWatcher('terra');
  const vaasByBlock = await watcher.getMessagesForBlocks(10975000, 10975010);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
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
  const watcher = new InjectiveExplorerWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(23333696);
});

test('getMessagesForBlocks(injective)', async () => {
  const watcher = new InjectiveExplorerWatcher();
  const vaasByBlock = await watcher.getMessagesForBlocks(24905509, 24905510);
  // const vaasByBlock = await watcher.getMessagesForBlocks(4209642, 4209643); // Testnet
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['24905509/2023-01-27T19:11:35.174Z']).toBeDefined();
  expect(vaasByBlock['24905509/2023-01-27T19:11:35.174Z'].length).toEqual(1);
  expect(vaasByBlock['24905509/2023-01-27T19:11:35.174Z'][0]).toEqual(
    '0xab3f3f6ebd51c4776eeb5d0eef525207590daab24cf794434387747395a3e904:19/00000000000000000000000045dbea4617971d93188eda21530bc6503d153313/33'
  );
});

// skipped because the SeiExplorerWatcher is used
test.skip('getFinalizedBlockNumber(sei)', async () => {
  const watcher = new CosmwasmWatcher('sei');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  console.log(blockNumber);
  expect(blockNumber).toBeGreaterThan(0);
});

// skipped because the SeiExplorerWatcher is used
test.skip('getMessagesForBlocks(sei)', async () => {
  const watcher = new CosmwasmWatcher('sei');
  const vaasByBlock = await watcher.getMessagesForBlocks(18907686, 18907687);
  const entries = Object.entries(vaasByBlock);
  console.log(entries);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(1);
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z']).toBeDefined();
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z'].length).toEqual(2);
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z']).toEqual([
    'BB54EC8EBE75644D9EC12FED3BFAF7311CF4A813CB26F188C78AF3E9A27D0FB4:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/1479',
    '6C586010F41DB1F75BCAE8AD6E823F2618A94E567939E3B31E7D55C2EE542698:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/1480',
  ]);
});

test('getFinalizedBlockNumber(sei explorer)', async () => {
  const watcher = new SeiExplorerWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  console.log(blockNumber);
  expect(blockNumber).toBeGreaterThan(0);
});

// skipped because it takes more and more time to paginate back
test.skip('getMessagesForBlocks(sei explorer)', async () => {
  const watcher = new SeiExplorerWatcher();
  const vaasByBlock = await watcher.getMessagesForBlocks(19061244, 19061245);
  const entries = Object.entries(vaasByBlock);
  console.log(entries);
  expect(entries.length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z']).toBeDefined();
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z'].length).toEqual(1);
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z']).toEqual([
    'E66AC5A3C288A3FCC05CCE57863AAAA8F27035FE73088FA0278C4315F18AB443:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/5016',
  ]);
});

test('getFinalizedBlockNumber(wormchain)', async () => {
  const watcher = new WormchainWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  console.log(blockNumber);
  expect(blockNumber).toBeGreaterThan(Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.wormchain));
});

test('getMessagesForBlocks(wormchain)', async () => {
  const watcher = new WormchainWatcher();
  const vaasByBlock = await watcher.getMessagesForBlocks(4510119, 4510119);
  const entries = Object.entries(vaasByBlock);
  console.log(entries);
  expect(entries.length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['4510119/2023-08-25T07:54:58.406Z']).toBeDefined();
  expect(vaasByBlock['4510119/2023-08-25T07:54:58.406Z'].length).toEqual(1);
  expect(vaasByBlock['4510119/2023-08-25T07:54:58.406Z']).toEqual([
    '4D861F1BE86325D227FA006CA2745BBC6748AF5B5E0811DE536D02792928472A:3104/aeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924/0',
  ]);
});
