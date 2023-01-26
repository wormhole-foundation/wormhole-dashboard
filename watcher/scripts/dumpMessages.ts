import * as dotenv from 'dotenv';
dotenv.config();
import {
  CHAINS,
  CHAIN_ID_PYTHNET,
  CHAIN_ID_UNSET,
  coalesceChainName,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { assertEnvironmentVariable, padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import { appendFileSync, closeSync, openSync } from 'fs';
import ora from 'ora';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { BigtableMessagesResultRow } from '../src/databases/types';
import { parseMessageId } from '../src/databases/utils';

// This script dumps all VAAs to a csv file compatible with the guardian `sign-existing-vaas-csv` admin command

const LIMIT = 10000;

(async () => {
  const fd = openSync(`messages-${new Date().toISOString()}.csv`, 'a');
  try {
    const bt = new BigtableDatabase();
    if (!bt.bigtable) {
      throw new Error('bigtable is undefined');
    }
    const messageTableId = assertEnvironmentVariable('BIGTABLE_TABLE_ID');
    const instance = bt.bigtable.instance(bt.instanceId);
    const messageTable = instance.table(messageTableId);
    const filteredChainIds = Object.values(CHAINS).filter(
      (c) => c !== CHAIN_ID_PYTHNET && c !== CHAIN_ID_UNSET
    );
    for (const chain of filteredChainIds) {
      const chainName = coalesceChainName(chain);
      let total = 0;
      let log = ora(`Fetching all ${chainName} messages...`).start();
      let start = `${padUint16(chain.toString())}/`;
      while (start) {
        log.text = `Fetching ${LIMIT}/${total} ${chainName} messages starting at ${start}...`;
        let messageRows = (
          await messageTable.getRows({
            start,
            end: `${padUint16(chain.toString())}/z`,
            limit: LIMIT,
          })
        )[0] as BigtableMessagesResultRow[];
        start = messageRows.length === LIMIT ? messageRows[LIMIT - 1].id : '';
        messageRows = messageRows.filter((row) => row.id.toString() !== start.toString());
        total += messageRows.length;
        log.text = `Processing ${total} ${chainName} messages...`;
        for (const row of messageRows) {
          const { chain, emitter, sequence } = parseMessageId(row.id);
          appendFileSync(
            fd,
            `${chain},${emitter},${sequence.toString()},${row.data.info.txHash?.[0].value}\n`
          );
        }
      }
      log.succeed(`Processed ${total} ${chainName} messages...`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    closeSync(fd);
  }
})();
