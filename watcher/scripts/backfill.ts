import * as dotenv from 'dotenv';
dotenv.config();
import { chunkArray, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { JsonDatabase } from '../src/databases/JsonDatabase';
import { VaasByBlock } from '../src/databases/types';
import { ChainId, toChain } from '@wormhole-foundation/sdk-base';

// This script backfills the bigtable db from a json db

(async () => {
  const localDb = new JsonDatabase();
  const remoteDb = new BigtableDatabase();

  const dbEntries = Object.entries(localDb.db);
  for (const [chain, vaasByBlock] of dbEntries) {
    console.log('backfilling', chain);
    const chunkedKeys = chunkArray(Object.keys(vaasByBlock), 1000);
    let chunk = 1;
    for (const chunkeyKeys of chunkedKeys) {
      console.log('chunk', chunk++, 'of', chunkedKeys.length);
      const chunkedVaasByBlock = chunkeyKeys.reduce<VaasByBlock>((obj, curr) => {
        obj[curr] = vaasByBlock[curr];
        return obj;
      }, {});
      await remoteDb.storeVaasByBlock(toChain(Number(chain) as ChainId), chunkedVaasByBlock);
      await sleep(500);
    }
  }
  const lastBlockEntries = Object.entries(localDb.lastBlockByChain);
  for (const [chain, blockKey] of lastBlockEntries) {
    console.log('backfilling last block for', chain, blockKey);
    await remoteDb.storeLatestBlock(toChain(Number(chain) as ChainId), blockKey, 'vaa');
    await sleep(500);
  }
})();
