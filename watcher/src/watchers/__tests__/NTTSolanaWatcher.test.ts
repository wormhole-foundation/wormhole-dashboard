import { expect, jest, test } from '@jest/globals';
import { NTTSolanaWatcher } from '../NTTSolanaWatcher';
import {
  NativeTokenTransfer,
  NttManagerMessage,
  ValidatedTransceiverMessage,
} from '../NTTPayloads';

jest.setTimeout(60_000);

// from solana
// '2B9J3WQSeEqzWtmXLsgX97TkRTbYoCHGcmShPkac5hJGGNVB7XiKxhz8ayj8MQX8DEMiG8ZfEbBDvqphq1PqH9H3', // 1/7e6436b671cce379a1fa9833783e28b36d39a00e2cdc6bfeab5d2d836eb61c7f/19
// to solana
// '4Xq6C4hwZChM6RZm8ibqXRATsqNhg1w5UaNgvWa1o8kLzPuzDUCS68tDL2d5vkxjQkLSmMKCZ7MLUhahcbb3WB47', // 10002/0000000000000000000000001fdc902e30b188fd2ba976b421cb179943f57896/9

test('deserializeValidatedTransceiverMessage', async () => {
  const data =
    '6100707d6bdc25b51227000000000000000000000000b231ad95f2301bc82ea44c515001f0f746d637e00ba50e1661e1aa0c07afdbac8349e925b1994b9c3ce2a647523704eba200985c0000000000000000000000000000000000000000000000000000000000000008000000000000000000000000bd4488ee939a63edea7d63ca7af2a713c699331d40420f0000000000080000000000000000000000001d30e78b7c7fbbcef87ae6e97b5389b2e470ca4a010049dfaf3b830ff50e1b02f3dd31218693543a19a34e39991edea250d42739b2920000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  const transceiverMessageData = ValidatedTransceiverMessage.deserialize(
    Buffer.from(data, 'hex'),
    (a) => {
      return NttManagerMessage.deserializeAccountFormat(
        a,
        NativeTokenTransfer.deserializeAccountFormat
      );
    }
  );

  if (!transceiverMessageData) {
    console.log('transceiverMessageData is null');
    return;
  }

  expect(transceiverMessageData.chainId).toBe(10002);
  expect(transceiverMessageData.sourceNttManager.toString('hex')).toBe(
    '000000000000000000000000b231ad95f2301bc82ea44c515001f0f746d637e0'
  );
  expect(transceiverMessageData.recipientNttManager.toString('hex')).toBe(
    '0ba50e1661e1aa0c07afdbac8349e925b1994b9c3ce2a647523704eba200985c'
  );
  expect(transceiverMessageData.ntt_managerPayload.id.toString('hex')).toBe(
    '0000000000000000000000000000000000000000000000000000000000000008'
  );
  expect(transceiverMessageData.ntt_managerPayload.sender.toString('hex')).toBe(
    '000000000000000000000000bd4488ee939a63edea7d63ca7af2a713c699331d'
  );
  expect(transceiverMessageData.ntt_managerPayload.payload.recipientAddress.toString('hex')).toBe(
    '49dfaf3b830ff50e1b02f3dd31218693543a19a34e39991edea250d42739b292'
  );
  expect(transceiverMessageData.ntt_managerPayload.payload.trimmedAmount.amount).toBe(1000000n);
  expect(transceiverMessageData.ntt_managerPayload.payload.trimmedAmount.decimals).toBe(8);
  expect(transceiverMessageData.ntt_managerPayload.payload.recipientChain).toBe(1);
  expect(transceiverMessageData.ntt_managerPayload.payload.sourceToken.toString('hex')).toBe(
    '0000000000000000000000001d30e78b7c7fbbcef87ae6e97b5389b2e470ca4a'
  );
});

// testing two transactions listed above
// This test is working, but testing it is not very useful since the return value is just the lastBlockKey.
// It is just an entrypoint to test the whole thing with a local postgres database.
test.skip('getNttMessagesForBlock', async () => {
  const watcher = new NTTSolanaWatcher('testnet');
  await watcher.getNttMessagesForBlocks(285100152, 285101059);
});
