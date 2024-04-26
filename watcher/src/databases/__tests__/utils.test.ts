import { expect, test } from '@jest/globals';
import { INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { JsonDatabase } from '../JsonDatabase';
import { getResumeBlockByChain, initDb, makeBlockKey } from '../utils';
import { chainToChainId } from '@wormhole-foundation/sdk-base';

test('getResumeBlockByChain', async () => {
  const db = initDb() as JsonDatabase;
  const fauxBlock = '98765';
  const blockKey = makeBlockKey(fauxBlock, new Date().toISOString());
  db.lastBlockByChain = { [chainToChainId('Solana')]: blockKey };
  // if a chain is in the database, that number should be returned
  expect(await db.getLastBlockByChain('Solana')).toEqual(fauxBlock);
  expect(await getResumeBlockByChain('Mainnet', 'Solana', false)).toEqual(Number(fauxBlock) + 1);
  // if a chain is not in the database, the initial deployment block should be returned
  expect(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Moonbeam).toBeDefined();
  expect(await getResumeBlockByChain('Mainnet', 'Moonbeam', false)).toEqual(
    Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Mainnet'].Moonbeam)
  );
});
