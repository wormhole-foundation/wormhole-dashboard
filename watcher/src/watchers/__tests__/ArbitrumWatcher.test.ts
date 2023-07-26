import { expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { ArbitrumWatcher } from '../ArbitrumWatcher';

jest.setTimeout(60000);

const initialArbitrumBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.arbitrum);
const initialEthBlock = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.ethereum);

test('getFinalizedBlockNumber', async () => {
  const watcher = new ArbitrumWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  // The blockNumber is 0 because the most recent L2 block isn't in
  // a finalized L1 block, yet.  It's in an L1 block.  That L1 block
  // just isn't finalized, yet.  Now, if we had this test run for like
  // 20 minutes, then we would get a non-zero result.
  expect(blockNumber).toEqual(0);
  let retval: number[] = watcher.getFirstMapEntry();
  expect(retval[0]).toBeGreaterThan(initialEthBlock);
  expect(retval[1]).toBeGreaterThan(initialArbitrumBlock);
});

test('getMessagesForBlocks', async () => {
  const watcher = new ArbitrumWatcher();
  const vaasByBlock = await watcher.getMessagesForBlocks(114500582, 114500584);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(3);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['114500583/2023-07-24T15:12:14.000Z']).toBeDefined();
  expect(vaasByBlock['114500583/2023-07-24T15:12:14.000Z'].length).toEqual(1);
  expect(vaasByBlock['114500583/2023-07-24T15:12:14.000Z'][0]).toEqual(
    '0x39da3b500e5d65e82ca20cc8c4737fc0aa6c4e2c6c5f7e657834bd607c7109d9:23/0000000000000000000000000b2402144bb366a632d14b83f244d2e0e21bd39c/7628'
  );
});
