import { Bigtable } from '@google-cloud/bigtable';
import { assertEnvironmentVariable } from './utils';
import { Firestore } from 'firebase-admin/firestore';
import { MessageCountsHistory } from './types';
import { deserialize } from '@wormhole-foundation/sdk-definitions';
import { toChainId } from '@wormhole-foundation/sdk-base';

export async function computeMessageCountHistory(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  try {
    const bigtable = new Bigtable();
    const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
    const signedVAAsTable = instance.table(
      assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID')
    );
    const readChunkSize = 10_000;
    const messageCounts: MessageCountsHistory = {
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
        const parsed = deserialize('Uint8Array', signedVAA.data.info.bytes[0].value);
        if (parsed.timestamp === 0) {
          // e.g. governance VAAs may have timestamp set to 0
          continue;
        }
        const date = new Date(parsed.timestamp * 1000).toISOString().slice(0, 10);
        messageCounts.DailyTotals[date] = {
          ...messageCounts.DailyTotals[date],
          [toChainId(parsed.emitterChain)]:
            (messageCounts.DailyTotals[date]?.[toChainId(parsed.emitterChain).toString()] || 0) + 1,
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
      await collection.doc(date).set(msgs, { merge: true }); // fly writes pythnet counts, don't overwrite (merge)
    }
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
