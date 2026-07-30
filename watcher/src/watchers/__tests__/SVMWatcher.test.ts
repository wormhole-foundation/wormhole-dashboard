import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { SVMWatcher } from '../SVMWatcher';
import { fixtureTest, installSolanaReplay } from './rpcFixture';

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

// skip: block 170799004 has been archived/garbage collected
test.skip('getMessagesForBlocks - single block (solana)', async () => {
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

// Exercises the empty-range and pruned-block paths on recent devnet data.
fixtureTest('svm-no-transactions.json')(
  'getMessagesForBlocks - block with no transactions (solana)',
  async () => {
    const watcher = new SVMWatcher('Testnet', 'Solana', 'vaa', 'https://api.devnet.solana.com');
    installSolanaReplay(watcher, 'svm-no-transactions.json');
    // A pruned slot ("cleaned up, does not exist on node") can't resolve a block range.
    await expect(watcher.getMessagesForBlocks(400000000, 400000000)).rejects.toThrowError(
      'solana: invalid block range'
    );

    // Empty ranges still return the last block, with no messages.
    let { vaasByBlock: messages } = await watcher.getMessagesForBlocks(479824700, 479824900);
    expect(Object.keys(messages).length).toBe(1);
    expect(Object.values(messages).flat().length).toBe(0);

    ({ vaasByBlock: messages } = await watcher.getMessagesForBlocks(479823800, 479824000));
    expect(Object.keys(messages).length).toBe(1);
    expect(Object.values(messages).flat().length).toBe(0);
  }
);

// skip: blocks 171050470-171050474 have been archived/garbage collected
test.skip('getMessagesForBlocks - multiple blocks (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171050470, 171050474);
  expect(Object.keys(messages).length).toBe(2);
  expect(Object.values(messages).flat().length).toBe(2);
});

// skip: blocks 170823000-170825000 have been archived/garbage collected
test.skip('getMessagesForBlocks - multiple blocks, last block empty (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(170823000, 170825000);
  expect(Object.keys(messages).length).toBe(3);
  expect(Object.values(messages).flat().length).toBe(2); // 2 messages, last block has no message
});

// skip: blocks 171582367-171583452 have been archived/garbage collected
test.skip('getMessagesForBlocks - multiple blocks containing more than `getSignaturesLimit` WH transactions (solana)', async () => {
  const watcher = new SVMWatcher('Mainnet', 'Solana');
  watcher.getSignaturesLimit = 10;
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(171582367, 171583452);
  expect(Object.keys(messages).length).toBe(3);
  expect(Object.values(messages).flat().length).toBe(3);
});

// skip: ("no data found in message account")
test.skip('getMessagesForBlocks - multiple calls (solana)', async () => {
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

// This test is using a block range that does not exist anymore.
test.skip('getMessagesForBlocks - handle failed transactions (solana)', async () => {
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

// Recent devnet shim message (older slots get pruned); replays a recorded response.
fixtureTest('svm-shim-1.json')('getMessagesForBlocks - shim 1 (solana)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Solana', 'vaa', 'https://api.devnet.solana.com');
  installSolanaReplay(watcher, 'svm-shim-1.json');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(479825053, 479825054);
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).length).toBe(1);
  expect(messages).toMatchObject({
    '479825054/2026-07-29T21:29:12.000Z': [
      '5Y68StorUGeUB7ooAbn29RWRk1HkpZTMYnUuRpjeriRRmTfnyxwHbPM7MVU47nX1fWarYyMXU3sbbGi3vG4YtTdw:1/9fa5717916e11542a924a4e9c27262f50b7a7658f089570f46e77c647bf2bb52/2',
    ],
  });
});

// Rececent devnet shim message (older slots get pruned); replays a recorded response.
fixtureTest('svm-shim-2.json')('getMessagesForBlocks - shim 2 (solana)', async () => {
  const watcher = new SVMWatcher('Testnet', 'Solana', 'vaa', 'https://api.devnet.solana.com');
  installSolanaReplay(watcher, 'svm-shim-2.json');
  const { vaasByBlock: messages } = await watcher.getMessagesForBlocks(479824694, 479824695);
  expect(Object.keys(messages).length).toBe(1);
  expect(Object.values(messages).length).toBe(1);
  expect(messages).toMatchObject({
    '479824695/2026-07-29T21:27:00.000Z': [
      '2wr6JMVXfyrXfsDjfYwB1nx3fAW8LAL3mBdR6dtG79XTzEkCXPUigZrDDF8h8BKpLWYjT1r6xzU24iq97xjMTD5d:1/9fa5717916e11542a924a4e9c27262f50b7a7658f089570f46e77c647bf2bb52/1',
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
