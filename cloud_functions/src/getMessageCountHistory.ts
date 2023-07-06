import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';
import { MessageCountsHistory as MessageCountHistory } from './types';

let messageCountHistory: MessageCountHistory | undefined;
let lastUpdated: number | undefined;
const updateIntervalMs = 60 * 60 * 1000; // 1 hour

export async function getMessageCountHistory(req: any, res: any) {
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
    const now = Date.now();
    if (!lastUpdated || now - lastUpdated >= updateIntervalMs) {
      const firestore = new Firestore();
      const collection = await firestore
        .collection(
          assertEnvironmentVariable(
            'FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION'
          )
        )
        .get();
      const tmpMessageCountHistory: MessageCountHistory = { DailyTotals: {} };
      for (const doc of collection.docs) {
        const date = doc.id;
        const countsByChain = doc.data() as { [chainId: string]: number };
        const total = Object.values(countsByChain).reduce(
          (partialSum, count) => partialSum + count,
          0
        );
        countsByChain['*'] = total;
        tmpMessageCountHistory.DailyTotals = {
          ...tmpMessageCountHistory.DailyTotals,
          [date]: countsByChain,
        };
      }
      messageCountHistory = tmpMessageCountHistory;
      lastUpdated = now;
      console.log('Updated message count history cache');
    }
    res.json(messageCountHistory);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
