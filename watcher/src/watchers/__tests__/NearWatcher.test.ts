import { describe, expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import { RPCS_BY_CHAIN } from '../../consts';
import {
  getMessagesFromBlockResults,
  getNearProvider,
  getTransactionsByAccountId,
  NEAR_ARCHIVE_RPC,
} from '../../utils/near';
import { NearArchiveWatcher } from '../NearArchiveWatcher';
import { contracts } from '@wormhole-foundation/sdk-base';

jest.setTimeout(60000);

const INITIAL_NEAR_BLOCK = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Near ?? 0
);
let archiveWatcher: NearArchiveWatcher = new NearArchiveWatcher('Mainnet');

test('getFinalizedBlockNumber', async () => {
  const blockNumber = await archiveWatcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(INITIAL_NEAR_BLOCK);
});

// No more "too old" blocks
test.skip('getMessagesForBlocks', async () => {
  // requests that are too old for rpc node should error, be caught, and return an empty object
  const messages = await archiveWatcher.getMessagesForBlocks(
    INITIAL_NEAR_BLOCK,
    INITIAL_NEAR_BLOCK
  );
  console.log('messages', messages);
  expect(Object.keys(messages).length).toEqual(1);
});

describe('getNearProvider', () => {
  test('with normal RPC', async () => {
    const provider = await getNearProvider('Mainnet', RPCS_BY_CHAIN['Mainnet']['Near']!);
    // grab last block from core contract
    expect(await provider.block({ finality: 'final' })).toBeTruthy();
  });

  test('with archive RPC', async () => {
    const provider = await getNearProvider('Mainnet', NEAR_ARCHIVE_RPC);
    const retval = await provider.block({
      blockId: '8NWwminTTAPwYzzqTeP8c3MEGXgTretBWpCSSvSqJXdv',
    });
    expect(retval).toBeTruthy();
  });
});

test.skip('getTransactionsByAccountId', async () => {
  let transactions = await getTransactionsByAccountId(
    contracts.coreBridge('Mainnet', 'Near'),
    10,
    1669731480649090392,
    '1669732480649090392'
  );
  expect(transactions.length).toEqual(10);
  expect(transactions[0].hash).toEqual('7jDrPnvErjbi3EHbQBcKT9wtiUPo77J9tpxXjE3KHcUp');

  // test custom timestamp, filtering out non function call actions, and querying last page
  transactions = await getTransactionsByAccountId(
    contracts.coreBridge('Mainnet', 'Near'),
    15,
    1661429814932000000,
    '1661429914932000000'
  );
  expect(transactions.length).toEqual(2);
  expect(transactions[0].hash).toEqual('3VivTHp1W5ErWgsASUQvW1qwoTCsxYeke4498apDJsss');
});

describe('getMessagesFromBlockResults', () => {
  test.skip('with Provider', async () => {
    const provider = await archiveWatcher.getProvider();
    const messages = await getMessagesFromBlockResults('Mainnet', provider, [
      await provider.block({ finality: 'final' }),
    ]);
    expect(messages).toBeTruthy();
  });

  test.skip('with ArchiveProvider', async () => {
    const provider = await getNearProvider('Mainnet', NEAR_ARCHIVE_RPC);
    const messages = await getMessagesFromBlockResults('Mainnet', provider, [
      await provider.block({ blockId: 'Bzjemj99zxe1h8kVp8H2hwVifmbQL8HT34LyPHzEK5qp' }),
      await provider.block({ blockId: '4SHFxSo8DdP8DhMauS5iFqfmdLwLET3W3e8Lg9PFvBSn' }),
      await provider.block({ blockId: 'GtQYaYMhrDHgLJJTroUaUzSR24E29twewpkqyudrCyVN' }),
    ]);
    expect(messages).toMatchObject({
      '72777217/2022-08-25T18:42:26.121Z': [],
      '74616314/2022-09-21T18:48:05.392Z': [
        'SYRSkE8pBWWLPZWJtHEGN5Hk7SPZ7kHgf4D1Q4viRcz:15/148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7/233',
      ],
      '74714181/2022-09-23T05:15:53.722Z': [
        '2xh2rLR3ehjRRjU1BbuHEhU6FbXiKp5rZ88niyKC6MBs:15/148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7/237',
      ],
    });

    // validate keys
    const blockKey = Object.keys(messages).at(-1)!;
    expect(archiveWatcher.isValidBlockKey(blockKey)).toBe(true);
    expect(archiveWatcher.isValidVaaKey(messages[blockKey][0])).toBe(true);
  });
});
