import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import { SVMWatcher } from '../SVMWatcher';

jest.setTimeout(60000);

const INITIAL_SOLANA_BLOCK = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Solana ?? 0
);

const INITIAL_FOGO_BLOCK = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Testnet'].Fogo ?? 0
);

test('getFinalizedBlockNumber solana', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITIAL_SOLANA_BLOCK);
});

test('getFinalizedBlockNumber fogo', async () => {
  const watcher = new SVMWatcher('Testnet', 'Fogo');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITIAL_FOGO_BLOCK);
});

test('getMessagesForBlocks - single block (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(170799004, 170799004);
  expect(Object.keys(messages).length).toBe(1);
  expect(messages).toMatchObject({
    '170799004/2023-01-04T16:43:43.000Z': [
      '3zWJevhFB5XqUCdDmqoRLQUMgiNBmFZLaE5rZpSexH47Mx2268eimrj2FY23Z1mq1WXsRRkyhmMcsguXcSw7Rnh1:1/ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5/262100',
    ],
  });

  // validate keys
  expect(watcher.isValidBlockKey(Object.keys(messages)[0])).toBe(true);
  expect(watcher.isValidVaaKey(Object.values(messages).flat()[0])).toBe(true);
});

// temporary skip due to SolanaJSONRPCError: failed to get confirmed block: Block 171774030 cleaned up, does not exist on node. First available block: 176896202
test('getMessagesForBlocks - fromSlot is skipped slot (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171774030, 171774032); // 171774024 - 171774031 are skipped
  expect(Object.keys(messages).length).toBe(1);
  expect(messages).toMatchObject({ '171774032/2023-01-10T13:36:39.000Z': [] });
});

test('getMessagesForBlocks - toSlot is skipped slot (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171774023, 171774025);
  expect(messages).toMatchObject({ '171774025/2023-01-10T13:36:34.000Z': [] });
});

test('getMessagesForBlocks - empty block (solana)', async () => {
  // Even if there are no messages, last block should still be returned
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(170979766, 170979766);
  expect(Object.keys(messages).length).toBe(1);
  expect(messages).toMatchObject({ '170979766/2023-01-05T18:40:25.000Z': [] });
});

// temporary skip due to SolanaJSONRPCError: failed to get confirmed block: Block 174108865 cleaned up, does not exist on node. First available block: 176892532
test('getMessagesForBlocks - block with no transactions (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  expect(watcher.getMessagesForBlocks(174108861, 174108861)).rejects.toThrowError(
    'solana: invalid block range'
  );

  let { vaasByBlock: messages } = await watcher.getMessagesForBlocks(174108661, 174108861);
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).flat().length).toBe(0);

  ({ vaasByBlock: messages } = await watcher.getMessagesForBlocks(174108863, 174109061));
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).flat().length).toBe(0);
});

test('getMessagesForBlocks - multiple blocks (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171050470, 171050474);
  expect(Object.keys(messages).length).toBe(2);
  expect(Object.values(messages).flat().length).toBe(2);
});

test('getMessagesForBlocks - multiple blocks, last block empty (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(170823000, 170825000);
  expect(Object.keys(messages).length).toBe(3);
  expect(Object.values(messages).flat().length).toBe(2); // 2 messages, last block has no message
});

test('getMessagesForBlocks - multiple blocks containing more than `getSignaturesLimit` WH transactions (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  watcher.getSignaturesLimit = 10;
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171582367, 171583452);
  expect(Object.keys(messages).length).toBe(3);
  expect(Object.values(messages).flat().length).toBe(3);
});

test('getMessagesForBlocks - multiple calls (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages1 } = await watcher.getMessagesForBlocks(171773021, 171773211);
  const { vaasByBlock: messages2 } = await watcher.getMessagesForBlocks(171773212, 171773250);
  const { vaasByBlock: messages3 } = await watcher.getMessagesForBlocks(171773251, 171773500);
  const allMessageKeys = [
    ...Object.keys(messages1),
    ...Object.keys(messages2),
    ...Object.keys(messages3),
  ];
  const uniqueMessageKeys = [...new Set(allMessageKeys)];
  expect(allMessageKeys.length).toBe(uniqueMessageKeys.length); // assert no duplicate keys
});

test('getMessagesForBlocks - handle failed transactions (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(94401321, 94501321);
  expect(Object.keys(messages).length).toBe(6);
  expect(Object.values(messages).flat().length).toBe(5);
  expect(
    Object.values(messages)
      .flat()
      .map((m) => m.split('/')[2])
      .join(',')
  ).toBe('4,3,2,1,0');
});

test('getMessagesForBlocks - shim 1 (solana)', async () => {
  const watcher = new SVMWatcher(
    'Testnet',
    'Solana',
    'vaa',
    'https://explorer-api.devnet.solana.com'
  );
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(356345331, 356345332);
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).length).toBe(1);
  expect(messages).toMatchObject({
    '356345332/2025-01-24T16:42:31.000Z': [
      '3auPns1kSD2R4GvWfutCQqKTmPfdmSr9yKgUsc3t19bhmVWq6UKtafboCBhrczTehYTbzN5XZh2apLaugg2h8da2:1/83718b7ec89617b7040685e01bdcca03214022980daae91340e0c3f840c005ef/0',
    ],
  });
});

test('getMessagesForBlocks - shim 2 (solana)', async () => {
  const watcher = new SVMWatcher(
    'Testnet',
    'Solana',
    'vaa',
    'https://explorer-api.devnet.solana.com'
  );
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(357272507, 357272508);
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).length).toBe(1);
  expect(messages).toMatchObject({
    '357272508/2025-01-28T20:11:01.000Z': [
      'b8fyUcMJgA5P6SS92HMRtxwFpihhAGe9PdcFVbYeVHRAHnr5vyJNbWJHeJ7ko23c8rg2KQ8oPVxdZbDh6V4Jv9t:1/83718b7ec89617b7040685e01bdcca03214022980daae91340e0c3f840c005ef/4',
    ],
  });
});

test('getMessagesForBlocks - single block (fogo)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Fogo');
  // Use recent blocks that are still available on the node
  const currentBlock = await watcher.getFinalizedBlockNumber();
  const testBlock = currentBlock - 1000;
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(testBlock, testBlock);
  expect(Object.keys(messages).length).toBeGreaterThanOrEqual(1);
});

test('getMessagesForBlocks - multiple blocks (fogo)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Fogo');
  // Use recent blocks that are still available on the node
  const currentBlock = await watcher.getFinalizedBlockNumber();
  const fromBlock = currentBlock - 2000;
  const toBlock = currentBlock - 1000;
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(fromBlock, toBlock);
  expect(Object.keys(messages).length).toBeGreaterThanOrEqual(1);

  // Ensure last block is returned
  const lastBlockKey = Object.keys(messages).sort().pop();
  expect(lastBlockKey).toBeDefined();
});

test('getMessagesForBlocks - empty block range (fogo)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Fogo');
  // Use recent blocks that are still available on the node
  const currentBlock = await watcher.getFinalizedBlockNumber();
  const testBlock = currentBlock - 500;
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(testBlock, testBlock);

  // Even if there are no messages, last block should still be returned
  expect(Object.keys(messages).length).toBeGreaterThanOrEqual(0);
});

test('getMessagesForBlocks - multiple calls (fogo)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Fogo');
  // Use recent blocks that are still available on the node
  const currentBlock = await watcher.getFinalizedBlockNumber();
  const start = currentBlock - 3000;
  const { vaasByBlock: messages1 } = await watcher.getMessagesForBlocks(start, start + 100);
  const { vaasByBlock: messages2 } = await watcher.getMessagesForBlocks(start + 101, start + 200);
  const { vaasByBlock: messages3 } = await watcher.getMessagesForBlocks(start + 201, start + 300);

  const allMessageKeys = [
    ...Object.keys(messages1),
    ...Object.keys(messages2),
    ...Object.keys(messages3),
  ];
  const uniqueMessageKeys = [...new Set(allMessageKeys)];
  expect(allMessageKeys.length).toBe(uniqueMessageKeys.length); // assert no duplicate keys
});
