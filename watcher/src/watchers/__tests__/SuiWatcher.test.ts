import { beforeAll, expect, jest, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common/dist/consts';
import { SuiWatcher } from '../SuiWatcher';

jest.setTimeout(60000);

const INITIAL_CHECKPOINT = Number(
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Sui ?? 1581000
);

// Public Sui fullnodes prune historical checkpoint data; tests use a dynamically-computed
// recent range so they remain valid as the chain grows. A small head buffer avoids any
// finality/indexer-lag edge cases.
const HEAD_BUFFER = 100;
const RANGE_WIDTH = 5000; // ~25 minutes of Sui checkpoints; wide enough to virtually guarantee Wormhole activity

let watcher: SuiWatcher;
let latestCheckpoint: number;
let recentFrom: number;
let recentTo: number;

beforeAll(async () => {
  watcher = new SuiWatcher('Mainnet');
  latestCheckpoint = await watcher.getFinalizedBlockNumber();
  recentTo = latestCheckpoint - HEAD_BUFFER;
  recentFrom = recentTo - RANGE_WIDTH;
});

test('getFinalizedBlockNumber returns a checkpoint past the deployment block', () => {
  console.log('Received blockNumber:', latestCheckpoint);
  expect(latestCheckpoint).toBeGreaterThan(INITIAL_CHECKPOINT);
});

test('getMessagesForBlocks reserves a slot for fromCheckpoint', async () => {
  // single-checkpoint range: regardless of whether events exist, the initial slot must be present
  const { vaasByBlock } = await watcher.getMessagesForBlocks(recentFrom, recentFrom);

  const initialSlot = Object.keys(vaasByBlock).find((k) => k.startsWith(`${recentFrom}/`));
  expect(initialSlot).toBeDefined();
  expect(vaasByBlock[initialSlot!]).toBeDefined();
});

// guards against the gRPC `summary.timestamp` field being misinterpreted (seconds vs ms vs Timestamp proto)
test('initial slot timestamp parses as a real, recent date', async () => {
  const { vaasByBlock } = await watcher.getMessagesForBlocks(recentFrom, recentFrom);

  const initialSlot = Object.keys(vaasByBlock).find((k) => k.startsWith(`${recentFrom}/`));
  expect(initialSlot).toBeDefined();

  const isoTimestamp = initialSlot!.split('/').slice(1).join('/');
  const parsed = new Date(isoTimestamp);
  expect(Number.isNaN(parsed.getTime())).toBe(false);

  // a unit error (e.g. seconds interpreted as ms) would put the date in 1970 or far in the future
  const ageMs = Date.now() - parsed.getTime();
  expect(ageMs).toBeGreaterThan(0);
  expect(ageMs).toBeLessThan(24 * 60 * 60 * 1000);
});

test('getMessagesForBlocks over a multi-checkpoint range stays within the requested bounds', async () => {
  const { vaasByBlock } = await watcher.getMessagesForBlocks(recentFrom, recentTo);

  const blockKeys = Object.keys(vaasByBlock);
  expect(blockKeys.length).toBeGreaterThan(0);

  // verifies the off-by-one workaround (afterCheckpoint: from-1, beforeCheckpoint: to+1) doesn't leak events outside the range
  for (const blockKey of blockKeys) {
    const checkpoint = Number(blockKey.split('/')[0]);
    expect(checkpoint).toBeGreaterThanOrEqual(recentFrom);
    expect(checkpoint).toBeLessThanOrEqual(recentTo);
  }
});

test('event block keys have timestamps consistent with their checkpoints', async () => {
  // Catches a regression where event timestamps (msg.timestamp, in seconds) get mixed up with
  // checkpoint timestamps (summary.timestamp). Both should land in the recent window.
  const { vaasByBlock } = await watcher.getMessagesForBlocks(recentFrom, recentTo);

  for (const blockKey of Object.keys(vaasByBlock)) {
    if (vaasByBlock[blockKey].length === 0) continue; // skip empty slot for fromCheckpoint
    const iso = blockKey.split('/').slice(1).join('/');
    const t = new Date(iso);
    expect(Number.isNaN(t.getTime())).toBe(false);
    const ageMs = Date.now() - t.getTime();
    expect(ageMs).toBeGreaterThan(0);
    expect(ageMs).toBeLessThan(24 * 60 * 60 * 1000);
  }
});

test('VAA keys conform to <digest>:21/<emitter>/<sequence>', async () => {
  const { vaasByBlock } = await watcher.getMessagesForBlocks(recentFrom, recentTo);

  const vaaKeys = Object.values(vaasByBlock).flat();
  // a 5000-checkpoint window on Sui Mainnet (~25 min) should always contain Wormhole activity
  expect(vaaKeys.length).toBeGreaterThan(0);

  for (const vaa of vaaKeys) {
    // chainId is 21 for Sui; emitter is hex without 0x; sequence is numeric
    expect(vaa).toMatch(/^[A-Za-z0-9]+:21\/[0-9a-f]+\/\d+$/);
  }
});
