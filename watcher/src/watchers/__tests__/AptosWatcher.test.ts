import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import { AptosWatcher } from '../AptosWatcher';

jest.setTimeout(60000);

const INITAL_SEQUENCE_NUMBER = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.aptos ?? 0);

test('getFinalizedSequenceNumber', async () => {
  const watcher = new AptosWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITAL_SEQUENCE_NUMBER);
});

test('getMessagesForSequenceNumbers', async () => {
  const watcher = new AptosWatcher();
  const messages = await watcher.getMessagesForBlocks(0, 1);
  expect(messages).toMatchObject({
    '1095891/2022-10-19T00:55:54.676Z/0': [
      '0x27b5808a7cfdb688e02be192ed334da683975b7487e8be7a09670b3088b58908:22/0000000000000000000000000000000000000000000000000000000000000001/0',
    ],
    '1099053/2022-10-19T01:08:28.554Z/1': [
      '0x9c0d5200d61d20aa20c72f5785bee645dd7c526989443eed4140fb46e5207248:22/0000000000000000000000000000000000000000000000000000000000000001/1',
    ],
  });

  // test that block number, timestamp, and sequence number are all strictly increasing
  const latestSequenceNumber = await watcher.getFinalizedBlockNumber();
  const messageKeys = Object.keys(
    await watcher.getMessagesForBlocks(latestSequenceNumber - 50, latestSequenceNumber)
  ).sort();
  expect(messageKeys.length).toBe(watcher.maximumBatchSize);
  expect(Date.parse(messageKeys.at(-1)!.split('/')[1])).toBeLessThan(Date.now());
  let prevKey = messageKeys[0];
  for (let i = 1; i < 25; i++) {
    const currKey = messageKeys[i];
    const [prevBlockNumber, prevTimestamp, prevEventSequenceNumber] = prevKey.split('/');
    const [blockNumber, timestamp, eventSequenceNumber] = currKey.split('/');
    expect(Number(blockNumber)).toBeGreaterThan(Number(prevBlockNumber));
    expect(Date.parse(timestamp)).toBeGreaterThan(Date.parse(prevTimestamp));
    expect(Number(eventSequenceNumber)).toBeGreaterThan(Number(prevEventSequenceNumber));
    prevKey = currKey;
  }
});
