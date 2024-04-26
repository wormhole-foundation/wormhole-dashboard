import * as dotenv from 'dotenv';
dotenv.config();
import { padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import { appendFileSync, closeSync, openSync } from 'fs';
import ora from 'ora';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { BigtableSignedVAAsResultRow } from '../src/databases/types';
import { chainIdToChain, chainIds } from '@wormhole-foundation/sdk-base';

// This script dumps all VAAs to a csv file compatible with the guardian `sign-existing-vaas-csv` admin command

const LIMIT = 10000;

(async () => {
  const fd = openSync(`vaas-${new Date().toISOString()}.csv`, 'a');
  try {
    const bt = new BigtableDatabase();
    if (!bt.bigtable) {
      throw new Error('bigtable is undefined');
    }
    const instance = bt.bigtable.instance(bt.instanceId);
    const vaaTable = instance.table(bt.signedVAAsTableId);
    for (const chainId of chainIds) {
      const chainName = chainIdToChain(chainId);
      let total = 0;
      let log = ora(`Fetching all ${chainName} VAAs...`).start();
      let start = `${padUint16(chainId.toString())}/`;
      while (start) {
        log.text = `Fetching ${LIMIT}/${total} ${chainName} VAAs starting at ${start}...`;
        let vaaRows = (
          await vaaTable.getRows({
            start,
            end: `${padUint16(chainId.toString())}/z`,
            decode: false,
            limit: LIMIT,
          })
        )[0] as BigtableSignedVAAsResultRow[];
        start = vaaRows.length === LIMIT ? vaaRows[LIMIT - 1].id : '';
        vaaRows = vaaRows.filter((row) => row.id.toString() !== start.toString());
        total += vaaRows.length;
        log.text = `Processing ${total} ${chainName} VAAs...`;
        for (const row of vaaRows) {
          try {
            const vaaBytes = row.data.info.bytes?.[0].value;
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
