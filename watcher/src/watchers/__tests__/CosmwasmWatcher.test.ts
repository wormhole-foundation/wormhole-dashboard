import { expect, jest, test } from '@jest/globals';
import { CosmwasmWatcher, maybeBase64Decode } from '../CosmwasmWatcher';
import { InjectiveExplorerWatcher } from '../InjectiveExplorerWatcher';
import { SeiExplorerWatcher } from '../SeiExplorerWatcher';
import { WormchainWatcher } from '../WormchainWatcher';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { isBase64Encoded } from '../../utils/isBase64Encoded';

jest.setTimeout(60000);

test('getFinalizedBlockNumber(injective)', async () => {
  const watcher = new InjectiveExplorerWatcher('Mainnet');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(23333696);
});

test.skip('getMessagesForBlocks(injective)', async () => {
  const watcher = new InjectiveExplorerWatcher('Mainnet');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(61720293, 61720294);
  const entries = Object.entries(vaasByBlock);
  // console.log(entries); // Leave this in for future debugging
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['61720293/2024-02-26T21:06:12.205Z']).toBeDefined();
  expect(vaasByBlock['61720293/2024-02-26T21:06:12.205Z'].length).toEqual(1);
  expect(vaasByBlock['61720293/2024-02-26T21:06:12.205Z'][0]).toEqual(
    '0x2481ac7979d6ad78ef75906b66a7ce4c7580561740a5f8742fdb0a9dffa75171:19/00000000000000000000000045dbea4617971d93188eda21530bc6503d153313/7164'
  );
});

// skipped because the SeiExplorerWatcher is used
test.skip('getFinalizedBlockNumber(sei)', async () => {
  const watcher = new CosmwasmWatcher('Mainnet', 'Sei');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(0);
});

// skipped because the SeiExplorerWatcher is used
test.skip('getMessagesForBlocks(sei)', async () => {
  const watcher = new CosmwasmWatcher('Mainnet', 'Sei');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(18907686, 18907687);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(2);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(1);
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z']).toBeDefined();
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z'].length).toEqual(2);
  expect(vaasByBlock['18907686/2023-08-17T00:46:43.834Z']).toEqual([
    'BB54EC8EBE75644D9EC12FED3BFAF7311CF4A813CB26F188C78AF3E9A27D0FB4:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/1479',
    '6C586010F41DB1F75BCAE8AD6E823F2618A94E567939E3B31E7D55C2EE542698:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/1480',
  ]);
});

test.skip('getFinalizedBlockNumber(sei explorer)', async () => {
  const watcher = new SeiExplorerWatcher('Mainnet');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(0);
});

// skipped because it takes more and more time to paginate back
test.skip('getMessagesForBlocks(sei explorer)', async () => {
  const watcher = new SeiExplorerWatcher('Mainnet');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(19061244, 19061245);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z']).toBeDefined();
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z'].length).toEqual(1);
  expect(vaasByBlock['19061244/2023-08-17T16:52:07.156Z']).toEqual([
    'E66AC5A3C288A3FCC05CCE57863AAAA8F27035FE73088FA0278C4315F18AB443:32/86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e/5016',
  ]);
});

test('getFinalizedBlockNumber(wormchain)', async () => {
  const watcher = new WormchainWatcher('Mainnet');
  const blockNumber = await watcher.getFinalizedBlockNumber();
  expect(blockNumber).toBeGreaterThan(
    Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Wormchain)
  );
});

test('getMessagesForBlocks(wormchain)', async () => {
  const watcher = new WormchainWatcher('Mainnet');
  const { vaasByBlock } = await watcher.getMessagesForBlocks(8978585, 8978585);
  const entries = Object.entries(vaasByBlock);
  expect(entries.length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 0).length).toEqual(0);
  expect(entries.filter(([block, vaas]) => vaas.length === 1).length).toEqual(1);
  expect(entries.filter(([block, vaas]) => vaas.length === 2).length).toEqual(0);
  expect(vaasByBlock['8978585/2024-06-21T15:21:06.740Z']).toBeDefined();
  expect(vaasByBlock['8978585/2024-06-21T15:21:06.740Z'].length).toEqual(1);
  expect(vaasByBlock['8978585/2024-06-21T15:21:06.740Z']).toEqual([
    '2049E133A81F591BF4972494FCB4A76C2FC7576EAF4040FA228AFB3C182E64A9:3104/aeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924/37608',
  ]);
});

test('isBase64Encoded', async () => {
  const msg1: string = 'message.sender';
  const bmsg1: string = Buffer.from(msg1).toString('base64');
  const msg2: string = 'message.sequence';
  const bmsg2: string = Buffer.from(msg1).toString('base64');
  const msg3: string = '_contract.address';
  const bmsg3: string = Buffer.from(msg1).toString('base64');
  const msg4: string = 'contract.address';
  const bmsg4: string = Buffer.from(msg1).toString('base64');
  expect(isBase64Encoded(msg1)).toBe(false);
  expect(isBase64Encoded(msg2)).toBe(false);
  expect(isBase64Encoded(msg3)).toBe(false);
  expect(isBase64Encoded(msg4)).toBe(false);
  expect(isBase64Encoded(bmsg1)).toBe(true);
  expect(isBase64Encoded(bmsg2)).toBe(true);
  expect(isBase64Encoded(bmsg3)).toBe(true);
  expect(isBase64Encoded(bmsg4)).toBe(true);

  // This test shows the risk involved with checking for base64 encoding.
  // The following is, actually, clear text.  But it passes the base64 encoding check.
  // So, passing addresses into the check should be done with caution.
  const addr: string = 'terra12mrnzvhx3rpej6843uge2yyfppfyd3u9c3uq223q8sl48huz9juqffcnhp';
  expect(isBase64Encoded(addr)).toBe(true);

  const [key1, value1] = maybeBase64Decode(msg1, bmsg1);
  expect(key1).toBe(msg1);
  expect(value1).toBe(bmsg1);
  const [key2, value2] = maybeBase64Decode(bmsg1, bmsg1);
  expect(key2).toBe(msg1);
  expect(value2).toBe(msg1);
});
