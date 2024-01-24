import { CHAIN_ID_SOLANA } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { expect, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { JsonDatabase } from '../JsonDatabase';
import { getResumeBlockByChain, initDb, makeBlockKey } from '../utils';

test('getResumeBlockByChain', async () => {
  const db = initDb() as JsonDatabase;
  const fauxBlock = '98765';
  const blockKey = makeBlockKey(fauxBlock, new Date().toISOString());
  db.lastBlockByChain = { [CHAIN_ID_SOLANA]: blockKey };
  // if a chain is in the database, that number should be returned
  expect(await db.getLastBlockByChain('solana')).toEqual(fauxBlock);
  expect(await getResumeBlockByChain('mainnet', 'solana')).toEqual(Number(fauxBlock) + 1);
  // if a chain is not in the database, the initial deployment block should be returned
  expect(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['mainnet'].moonbeam).toBeDefined();
  expect(await getResumeBlockByChain('mainnet', 'moonbeam')).toEqual(
    Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['mainnet'].moonbeam)
  );
  // if neither, null should be returned
  expect(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['mainnet'].unset).toBeUndefined();
  expect(await getResumeBlockByChain('mainnet', 'unset')).toEqual(null);
});
