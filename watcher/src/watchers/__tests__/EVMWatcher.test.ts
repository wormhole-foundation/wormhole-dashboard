import { expect, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { Block, EVMWatcher, LOG_MESSAGE_PUBLISHED_TOPIC } from '../EVMWatcher';
import { contracts } from '@wormhole-foundation/sdk-base';

const initialAvalancheBlock = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Avalanche
);
const initialCeloBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Celo);
const initialOasisBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Oasis);

jest.setTimeout(60000);

test('getBlock by tag', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const block = await watcher.getBlock('latest');
  expect(block.number).toBeGreaterThan(initialAvalancheBlock);
  expect(block.timestamp).toBeGreaterThan(1671672811);
  expect(new Date(block.timestamp * 1000).toISOString() > '2022-12-21').toBeTruthy();
});

test('getBlock by number', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const block = await watcher.getBlock(46997506);
  expect(block.number).toEqual(46997506);
  expect(block.hash).toEqual('0x2d40ae06ad17d62b8e500cc451bc296e1e20c91140ce3cd6f2504bd3377e602f');
  expect(block.timestamp).toEqual(1718975498);
  expect(new Date(block.timestamp * 1000).toISOString()).toEqual('2024-06-21T13:11:38.000Z');
});

test('getBlocks', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const maxBatchSize = watcher.maximumBatchSize;
  const maxSizeMinusOne = maxBatchSize - 1;
  const avalancheBlock = 46997506;
  const blocks = await watcher.getBlocks(avalancheBlock, avalancheBlock + maxSizeMinusOne);
  expect(blocks.length).toEqual(maxBatchSize);
  expect(blocks[0].number).toEqual(avalancheBlock);
  expect(blocks[0].hash).toEqual(
    '0x2d40ae06ad17d62b8e500cc451bc296e1e20c91140ce3cd6f2504bd3377e602f'
  );
  expect(blocks[0].timestamp).toEqual(1718975498);
  expect(new Date(blocks[0].timestamp * 1000).toISOString()).toEqual('2024-06-21T13:11:38.000Z');
  expect(blocks[maxSizeMinusOne].number).toEqual(avalancheBlock + maxSizeMinusOne);
  expect(blocks[maxSizeMinusOne].hash).toEqual(
    '0x6308b1f713b1653d4959c9b43e586f1ff601fe5a453e411129d28b5c9208b2d5'
  );
  expect(blocks[maxSizeMinusOne].timestamp).toEqual(1718975702);
});

test('getLogs', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const logs = await watcher.getLogs(
    46997506,
    46997599,
    contracts.coreBridge('Mainnet', 'Avalanche'),
    [LOG_MESSAGE_PUBLISHED_TOPIC]
  );
  expect(logs.length).toEqual(1);
  expect(logs[0].topics[0]).toEqual(LOG_MESSAGE_PUBLISHED_TOPIC);
  expect(logs[0].blockNumber).toEqual(46997506);
  expect(logs[0].transactionHash).toEqual(
    '0xe112f65bccc2fee1b8940eb6efecc2a4b1419ce62b7d2ac1a82f7d6c01937198'
  );
});

test('getFinalizedBlockNumber', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(initialAvalancheBlock);
});

test('getMessagesForBlocks', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Avalanche');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(46997500, 46997599);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(100);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(99);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['46997506/2024-06-21T13:11:38.000Z']).toBeDefined();
  expect(vaasByBlock['46997506/2024-06-21T13:11:38.000Z'].length).toEqual(1);
  expect(vaasByBlock['46997506/2024-06-21T13:11:38.000Z'][0]).toEqual(
    '0xe112f65bccc2fee1b8940eb6efecc2a4b1419ce62b7d2ac1a82f7d6c01937198:6/0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052/219960'
  );
});

test('getBlock by tag (Oasis compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Oasis');
  const block = await watcher.getBlock('latest');
  expect(block.number).toBeGreaterThan(initialOasisBlock);
  expect(block.timestamp).toBeGreaterThan(3895665);
  expect(new Date(block.timestamp * 1000).toISOString() > '2022-12-21').toBeTruthy();
});

test('getBlock by tag (Celo compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Celo');
  const block = await watcher.getBlock('latest');
  expect(block.number).toBeGreaterThan(initialCeloBlock);
  expect(block.timestamp).toBeGreaterThan(1671672811);
  expect(new Date(block.timestamp * 1000).toISOString() > '2022-12-21').toBeTruthy();
});

test('getBlock by number (Celo compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Celo');
  const block = await watcher.getBlock(initialCeloBlock);
  expect(block.number).toEqual(initialCeloBlock);
  expect(block.timestamp).toEqual(1652314820);
  expect(new Date(block.timestamp * 1000).toISOString()).toEqual('2022-05-12T00:20:20.000Z');
});

test('getMessagesForBlocks (Celo compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Celo');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(13322450, 13322549);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(100);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(98);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['13322492/2022-06-02T17:40:22.000Z']).toBeDefined();
  expect(vaasByBlock['13322492/2022-06-02T17:40:22.000Z'].length).toEqual(1);
  expect(vaasByBlock['13322492/2022-06-02T17:40:22.000Z'][0]).toEqual(
    '0xd73c03b0d59ecae473d50b61e8756bc19b54314869e9b11d0fda6f89dbcf3918:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/5'
  );
});

test('getBlock by number (Karura compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Karura');
  const latestBlock = await watcher.getFinalizedBlockNumber();
  const moreRecentBlockNumber = 4646601;
  //   block {
  //   hash: '0xe370a794f27fc49d1e468c78e4f92f9aeefc949a62f919cea8d2bd81904840b5',
  //   number: 4646601,
  //   timestamp: 1687963290
  // }
  expect(latestBlock).toBeGreaterThan(moreRecentBlockNumber);
  const block = await watcher.getBlock(moreRecentBlockNumber);
  expect(block.number).toEqual(moreRecentBlockNumber);
  expect(block.timestamp).toEqual(1687963290);
  expect(new Date(block.timestamp * 1000).toISOString()).toEqual('2023-06-28T14:41:30.000Z');
});

test('getMessagesForBlocks (Karura compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Karura');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(4582511, 4582513);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(3);
  expect(entries[0][0]).toEqual('4582511/2023-06-19T15:54:48.000Z');
  // 4582512 was an error block. In that case, make sure it has the same timestamp as the previous block
  // expect(entries[1][0]).toEqual('4582512/2023-06-19T15:54:48.000Z');
  // As of July 15, 2023, the above block appears to have been fixed
  expect(entries[1][0]).toEqual('4582512/2023-06-19T15:55:00.000Z');
});

test('getMessagesForBlocks (Karura compatibility 2)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Karura');
  await watcher.getFinalizedBlockNumber(); // This has the side effect of initializing the latestFinalizedBlockNumber
  const { vaasByBlock } = await watcher.getMessagesForBlocks(4595356, 4595358);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(3);
});

// skipped as it was timing out the test
test.skip('getBlock (Karura compatibility)', async () => {
  const watcher = new EVMWatcher('Mainnet', 'Karura');
  await watcher.getFinalizedBlockNumber(); // This has the side effect of initializing the latestFinalizedBlockNumber
  let block: Block = await watcher.getBlock(4582512); // 6969 block
  console.log('block', block);
  block = await watcher.getBlock(4595357); // Null block
  console.log('block', block);
  // block = await watcher.getBlock(4595358); // good block
  // console.log('block', block);
  // block = await watcher.getBlock(4619551); // good luck
  // console.log('block', block);
});
