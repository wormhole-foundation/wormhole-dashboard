import * as dotenv from 'dotenv';
dotenv.config();
import { appendFileSync, closeSync, openSync } from 'fs';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import {
  CHAINS,
  CHAIN_ID_PYTHNET,
  CHAIN_ID_UNSET,
  coalesceChainName,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import ora from 'ora';
import { BigtableVAAsResultRow } from '../src/databases/types';

// This script dumps all VAAs to a csv file compatible with the guardian `sign-existing-vaas-csv` admin command

const LIMIT = 10000;

(async () => {
  const fd = openSync(`vaas-${new Date().toISOString()}.csv`, 'a');
  try {
    const bt = new BigtableDatabase();
    if (!bt.bigtable) {
      throw new Error('bigtable is undefined');
    }
    const vaaTableId = assertEnvironmentVariable('BIGTABLE_VAA_TABLE_ID');
    const instance = bt.bigtable.instance(bt.instanceId);
    const vaaTable = instance.table(vaaTableId);
    const filteredChainIds = Object.values(CHAINS).filter(
      (c) => c !== CHAIN_ID_PYTHNET && c !== CHAIN_ID_UNSET
    );
    const filter = [
      {
        family: 'QuorumState',
        column: 'SignedVaa',
      },
    ];
    for (const chain of filteredChainIds) {
      const chainName = coalesceChainName(chain);
      let total = 0;
      let log = ora(`Fetching all ${chainName} VAAs...`).start();
      let start = `${chain}:`;
      while (start) {
        log.text = `Fetching ${LIMIT}/${total} ${chainName} VAAs starting at ${start}...`;
        let vaaRows = (
          await vaaTable.getRows({
            start,
            end: `${chain}:z`,
            decode: false,
            filter,
            limit: LIMIT,
          })
        )[0] as BigtableVAAsResultRow[];
        start = vaaRows.length === LIMIT ? vaaRows[LIMIT - 1].id : '';
        vaaRows = vaaRows.filter((row) => row.id.toString() !== start.toString());
        total += vaaRows.length;
        log.text = `Processing ${total} ${chainName} VAAs...`;
        for (const row of vaaRows) {
          try {
            const vaaBytes = row.data.QuorumState.SignedVAA?.[0].value;
            if (vaaBytes) {
              appendFileSync(fd, `${row.id},${vaaBytes.toString('hex')}\n`, 'utf8');
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      log.succeed(`Processed ${total} ${chainName} VAAs...`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    closeSync(fd);
  }
})();
