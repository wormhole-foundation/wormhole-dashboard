import dotenv from 'dotenv';
dotenv.config();
import { parseVaa } from '@certusone/wormhole-sdk';
import { Bigtable } from '@google-cloud/bigtable';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

(async () => {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const signedVAAsTable = instance.table(
    assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID')
  );
  const readChunkSize = 10_000;
  const messageCounts: { DailyTotals: { [date: string]: { [chain: string]: number } } } = {
    DailyTotals: {},
  };
  let start = '';
  let skipRow = false;
  while (true) {
    const signedVAARows = (
      await signedVAAsTable.getRows({
        start,
        decode: false,
        limit: readChunkSize,
      })
    )[0];
    for (const signedVAA of signedVAARows) {
      if (skipRow) {
        skipRow = false;
        continue;
      }
      const parsed = parseVaa(signedVAA.data.info.bytes[0].value);
      if (parsed.timestamp === 0) {
        continue;
      }
      const date = new Date(parsed.timestamp * 1000).toISOString().slice(0, 10);
      messageCounts.DailyTotals[date] = {
        ...messageCounts.DailyTotals[date],
        [parsed.emitterChain]:
          (messageCounts.DailyTotals[date]?.[parsed.emitterChain.toString()] || 0) + 1,
      };
    }
    if (signedVAARows.length < readChunkSize) {
      break;
    }
    start = signedVAARows[signedVAARows.length - 1].id.toString();
    // the last row of the current batch will be the start/first row of the next batch, so skip it
    skipRow = true;
  }
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION')
  );
  for (const [date, msgs] of Object.entries(messageCounts.DailyTotals)) {
    await collection.doc(date).set(msgs, { merge: true }); // merge with pythnet counts
  }
})();
