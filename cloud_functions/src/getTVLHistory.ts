import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';
import { ChainsAssets, NotionalByDate, TVLHistory } from './types';

let tvlHistory: TVLHistory | undefined;
let lastUpdated: number | undefined;
const updateIntervalMs = 60 * 60 * 1000; // 1 hour

export async function getTVLHistory(req: any, res: any) {
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
        .collection(assertEnvironmentVariable('FIRESTORE_TVL_HISTORY_COLLECTION'))
        .get();
      const tmpTVLHistory: TVLHistory = { DailyLocked: {} };
      for (const doc of collection.docs) {
        const date = doc.id;
        const notionalByDate = doc.data() as ChainsAssets;
        tmpTVLHistory.DailyLocked = {
          ...tmpTVLHistory.DailyLocked,
          [date]: notionalByDate,
        };
      }
      tvlHistory = tmpTVLHistory;
      lastUpdated = now;
      console.log('Updated cached tvl history');
    }
    res.json(tvlHistory);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
