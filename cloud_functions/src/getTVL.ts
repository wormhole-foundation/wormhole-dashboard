import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';
import { NotionalTVL } from './types';

let tvl: NotionalTVL | undefined;
let lastUpdated: number | undefined;
const updateIntervalMs = 60 * 60 * 1000; // 1 hour

export async function getTVL(req: any, res: any) {
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
      const collection = firestore.collection(
        assertEnvironmentVariable('FIRESTORE_TVL_COLLECTION')
      );
      tvl = (await collection.doc('tvl').get()).data() as NotionalTVL;
      lastUpdated = now;
      console.log('Updated cached tvl');
    }
    res.json(tvl);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
