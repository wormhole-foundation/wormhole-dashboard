import dotenv from 'dotenv';
dotenv.config();

import { describe, expect, jest, test } from '@jest/globals';
import { SolanaJSONRPCError } from '@solana/web3.js';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import { SolanaWatcher } from '../SolanaWatcher';

jest.setTimeout(60000);

const INITIAL_SOLANA_BLOCK = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.solana ?? 0);

test('getFinalizedBlockNumber', async () => {
  const watcher = new SolanaWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITIAL_SOLANA_BLOCK);
});

describe('getMessagesForBlocks', () => {
  test('single block', async () => {
    const watcher = new SolanaWatcher();
    const messages = await watcher.getMessagesForBlocks(170799004, 170799004);
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

  test('fromSlot is skipped slot', async () => {
    const watcher = new SolanaWatcher();
    const messages = await watcher.getMessagesForBlocks(171774030, 171774032); // 171774024 - 171774031 are skipped
    expect(Object.keys(messages).length).toBe(1);
    expect(messages).toMatchObject({ '171774032/2023-01-10T13:36:38.000Z': [] });
  });

  test('toSlot is skipped slot', async () => {
    const watcher = new SolanaWatcher();
    await expect(watcher.getMessagesForBlocks(171774023, 171774025)).rejects.toThrow(
      SolanaJSONRPCError
    );
  });

  test('empty block', async () => {
    // Even if there are no messages, last block should still be returned
    const watcher = new SolanaWatcher();
    const messages = await watcher.getMessagesForBlocks(170979766, 170979766);
    expect(Object.keys(messages).length).toBe(1);
    expect(messages).toMatchObject({ '170979766/2023-01-05T18:40:24.000Z': [] });
  });

  test('multiple blocks', async () => {
    const watcher = new SolanaWatcher();
    const messages = await watcher.getMessagesForBlocks(171050470, 171050474);
    expect(Object.keys(messages).length).toBe(2);
    expect(Object.values(messages).flat().length).toBe(2);
  });

  test('multiple blocks, last block empty', async () => {
    const watcher = new SolanaWatcher();
    const messages = await watcher.getMessagesForBlocks(170823000, 170825000);
    expect(Object.keys(messages).length).toBe(3);
    expect(Object.values(messages).flat().length).toBe(2); // 2 messages, last block has no message
  });

  test('multiple blocks containing more than `getSignaturesLimit` WH transactions', async () => {
    const watcher = new SolanaWatcher();
    watcher.getSignaturesLimit = 10;
    const messages = await watcher.getMessagesForBlocks(171582367, 171583452);
    expect(Object.keys(messages).length).toBe(3);
    expect(Object.values(messages).flat().length).toBe(3);
  });

  test('multiple calls', async () => {
    const watcher = new SolanaWatcher();
    const messages1 = await watcher.getMessagesForBlocks(171773021, 171773211);
    const messages2 = await watcher.getMessagesForBlocks(171773212, 171773250);
    const messages3 = await watcher.getMessagesForBlocks(171773251, 171773500);
    const allMessageKeys = [
      ...Object.keys(messages1),
      ...Object.keys(messages2),
      ...Object.keys(messages3),
    ];
    const uniqueMessageKeys = [...new Set(allMessageKeys)];
    expect(allMessageKeys.length).toBe(uniqueMessageKeys.length); // assert no duplicate keys
  });
});
