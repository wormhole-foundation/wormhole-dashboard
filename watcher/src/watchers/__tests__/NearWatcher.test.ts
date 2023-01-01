import { CONTRACTS } from '@certusone/wormhole-sdk';
import { describe, expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import {
  ARCHIVAL_NODE_RATE_LIMIT_MS,
  getArchivalRpcProvider,
  getTransactionsByAccountId,
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
  const provider = await getArchivalRpcProvider();
  const start = performance.now();

  // grab first block with activity from core contract
  expect(
    await provider.block({ blockId: 'Asie8hpJFKaipvw8jh1wPfBwwbjP6JUfsQdCuQvwr3Sz' })
  ).toBeTruthy();
  expect(performance.now() - start).toBeGreaterThan(ARCHIVAL_NODE_RATE_LIMIT_MS);
});

test('getTransactionsByAccountId', async () => {
  let transactions = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    10,
    '1669732480649090392'
  );
  expect(transactions.length).toEqual(10);
  expect(transactions[0].hash).toEqual('8Bnf3ehhB5AWLxjVXMcTUmku1SdKgRLZpVxN67ViDgiD');

  // test custom timestamp, filtering out non function call actions, and querying last page
  transactions = await getTransactionsByAccountId(
    CONTRACTS.MAINNET.near.core,
    15,
    '1661429914932000000'
  );
  expect(transactions.length).toEqual(2);
  expect(transactions.at(-1)?.hash).toEqual('3VivTHp1W5ErWgsASUQvW1qwoTCsxYeke4498apDJsss');
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
    const provider = await getArchivalRpcProvider();
    const messages = await getMessagesFromBlockResults(provider, [
      await provider.block({ blockId: 'Bzjemj99zxe1h8kVp8H2hwVifmbQL8HT34LyPHzEK5qp' }),
      await provider.block({ blockId: '4SHFxSo8DdP8DhMauS5iFqfmdLwLET3W3e8Lg9PFvBSn' }),
      await provider.block({ blockId: 'GtQYaYMhrDHgLJJTroUaUzSR24E29twewpkqyudrCyVN' }),
    ]);
    const blockKeys = Object.keys(messages);
    expect(blockKeys.length).toEqual(2);
    expect(blockKeys[0]).toEqual('74616314/1663786085392436500');
    expect(blockKeys[1]).toEqual('74714181/1663910153722175000');
  });
});
