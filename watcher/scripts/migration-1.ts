import * as dotenv from 'dotenv';
dotenv.config();
import { chunkArray, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { BigtableMessagesResultRow, BigtableMessagesRow } from '../src/databases/types';
import { makeMessageId, parseLegacyMessageId } from '../src/databases/utils';

// This script migrates the bigtable instance to the new message id format

(async () => {
  const currentDb = new BigtableDatabase();
  const mainnetInstance = currentDb.bigtable.instance(currentDb.instanceId);
  const messageTable = mainnetInstance.table(currentDb.tableId);
  const observedMessages = (await messageTable.getRows())[0] as BigtableMessagesResultRow[];
  const chunks = chunkArray(observedMessages, 1000);
  console.log('dropping rows...');
  const response = await messageTable.deleteRows('0');
  console.log(response);
  let count = 0;
  for (const chunk of chunks) {
    console.log('migrating chunk', ++count, 'of', chunks.length);
    const rowsToInsert: BigtableMessagesRow[] = [];
    for (const observedMessage of chunk) {
      const { chain, block, emitter, sequence } = parseLegacyMessageId(observedMessage.id);
      rowsToInsert.push({
        key: makeMessageId(chain, block.toString(), emitter, sequence.toString()),
        data: {
          info: {
            timestamp:
              observedMessage.data.info.timestamp?.[0].value !== undefined
                ? {
                    value: observedMessage.data.info.timestamp?.[0].value,
                    // write 0 timestamp to only keep 1 cell each
                    // https://cloud.google.com/bigtable/docs/gc-latest-value
                    timestamp: '0',
                  }
                : undefined,
            txHash:
              observedMessage.data.info.txHash?.[0].value !== undefined
                ? {
                    value: observedMessage.data.info.txHash?.[0].value,
                    timestamp: '0',
                  }
                : undefined,
            hasSignedVaa:
              observedMessage.data.info.hasSignedVaa?.[0].value !== undefined
                ? {
                    value: observedMessage.data.info.hasSignedVaa?.[0].value,
                    timestamp: '0',
                  }
                : undefined,
          },
        },
      });
    }
    await messageTable.insert(rowsToInsert);
    await sleep(500);
  }
})();
