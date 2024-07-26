import { Firestore } from 'firebase-admin/firestore';
import { ChainId } from '@wormhole-foundation/sdk-base';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

export type TvlTvm = {
  tvl: number;
  tvm: number;
};

export type ValuesByChain = {
  [chain in ChainId]?: { tvl: number; tvm: number };
};

async function getLatestTvlTvm_() {
  const firestoreCollection = assertEnvironmentVariable('FIRESTORE_LATEST_TVLTVM_COLLECTION');
  let values: ValuesByChain = {};
  const firestoreDb = new Firestore({});
  try {
    const collectionRef = firestoreDb.collection(firestoreCollection);
    const snapshot = await collectionRef.get();
    snapshot.docs
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((doc) => {
        values[Number(doc.id) as ChainId] = { tvl: doc.data().tvl, tvm: doc.data().tvm };
      });
  } catch (e) {
    console.error(e);
  }
  return values;
}

let cache = { values: {} as ValuesByChain, lastUpdated: Date.now() };
// default refresh interval = 60 min
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 60;

export async function getLatestTvlTvm(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  let values: ValuesByChain = {};
  try {
    if (
      Object.keys(cache['values']).length === 0 ||
      Date.now() - cache['lastUpdated'] > REFRESH_TIME_INTERVAL
    ) {
      if (Object.keys(cache['values']).length === 0) {
        console.log(`cache is empty, setting cache[values] ${new Date()}`);
      } else {
        console.log(`cache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`);
      }
      console.time('getLatestTvlTvm_');
      values = await getLatestTvlTvm_();
      console.timeEnd('getLatestTvlTvm_');
      cache['values'] = values;
      cache['lastUpdated'] = Date.now();
    } else {
      console.log(`cache is still valid, not refreshing ${new Date()}`);
      values = cache['values'];
    }
    res.status(200).send(JSON.stringify(values));
  } catch (e) {
    res.sendStatus(500);
  }
}
