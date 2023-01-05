import { CONTRACTS } from '@certusone/wormhole-sdk';
import { describe, expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import {
  getRateLimitedProvider,
  getTransactionsByAccountId,
  NEAR_ARCHIVE_NODE_RATE_LIMIT_MS,
  NEAR_ARCHIVE_RPC,
} from '../../utils/near';
import { getMessagesFromBlockResults, NearWatcher } from '../NearWatcher';

jest.setTimeout(60000);

const INITAL_NEAR_BLOCK = Number(INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN.near ?? 0);

test('getFinalizedBlockNumber', async () => {
  const watcher = new NearWatcher();
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITAL_NEAR_BLOCK);
});

test('getMessagesForBlocks', async () => {
  // requests that are too old for rpc node should error, be caught, and return an empty object
  const watcher = new NearWatcher();
  const messages = await watcher.getMessagesForBlocks(0, 0);
  expect(Object.keys(messages).length).toEqual(0);
});

test('getArchivalRpcProvider', async () => {
  const provider = await getRateLimitedProvider(NEAR_ARCHIVE_RPC);
  const start = performance.now();

  // grab first block with activity from core contract
  expect(
    await provider.block({ blockId: 'Asie8hpJFKaipvw8jh1wPfBwwbjP6JUfsQdCuQvwr3Sz' })
  ).toBeTruthy();
  expect(performance.now() - start).toBeGreaterThan(NEAR_ARCHIVE_NODE_RATE_LIMIT_MS);
});

test('getTransactionsByAccountId', async () => {
  let transactions = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    10,
    '1669732480649090392'
  );
  expect(transactions.length).toEqual(10);
  expect(transactions[0].hash).toEqual('7jDrPnvErjbi3EHbQBcKT9wtiUPo77J9tpxXjE3KHcUp');

  // test custom timestamp, filtering out non function call actions, and querying last page
  transactions = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    15,
    '1661429914932000000'
  );
  expect(transactions.length).toEqual(2);
  expect(transactions[0].hash).toEqual('3VivTHp1W5ErWgsASUQvW1qwoTCsxYeke4498apDJsss');
});

describe('getMessagesFromBlockResults', () => {
  test('with Provider', async () => {
    const watcher = new NearWatcher();
    const provider = await watcher.getProvider();
    const messages = getMessagesFromBlockResults(provider, [
      await provider.block({ finality: 'final' }),
    ]);
    expect(messages).toBeTruthy();
  });

  test('with ArchivalProvider', async () => {
    const provider = await getRateLimitedProvider(NEAR_ARCHIVE_RPC);
    const messages = await getMessagesFromBlockResults(provider, [
      await provider.block({ blockId: 'Bzjemj99zxe1h8kVp8H2hwVifmbQL8HT34LyPHzEK5qp' }),
      await provider.block({ blockId: '4SHFxSo8DdP8DhMauS5iFqfmdLwLET3W3e8Lg9PFvBSn' }),
      await provider.block({ blockId: 'GtQYaYMhrDHgLJJTroUaUzSR24E29twewpkqyudrCyVN' }),
    ]);
    const blockKeys = Object.keys(messages);
    expect(blockKeys.length).toEqual(2);
    expect(blockKeys[0]).toEqual('74616314/2022-09-21T18:48:05.392Z');
    expect(blockKeys[1]).toEqual('74714181/2022-09-23T05:15:53.722Z');
  });
});
