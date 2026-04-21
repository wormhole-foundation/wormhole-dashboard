import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

export type TokenData = {
  token_chain: number;
  token_address: string;
  native_address: string;
  coin_gecko_coin_id: string;
  decimals: number;
  symbol: string;
  name: string;
  price_usd: number;
};

export type TokenCache = {
  data?: TokenData[];
};

type LatestTokenDataDoc = {
  data: TokenData[];
  updatedAt: number;
};

let cache: { values: TokenCache; lastUpdated: number } = { values: {}, lastUpdated: 0 };
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 5;

export async function getLatestTokenData(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  try {
    if (!cache.values.data || Date.now() - cache.lastUpdated > REFRESH_TIME_INTERVAL) {
      const firestore = new Firestore();
      const collection = firestore.collection(
        assertEnvironmentVariable('FIRESTORE_LATEST_TOKEN_DATA_COLLECTION')
      );
      const doc = (await collection.doc('latest').get()).data() as LatestTokenDataDoc | undefined;
      cache = { values: { data: doc?.data || [] }, lastUpdated: Date.now() };
      console.log(`Refreshed latest-tokendata cache: ${cache.values.data?.length ?? 0} entries`);
    }
    res.status(200).json(cache.values);
  } catch (e) {
    console.error(`Error getting latest token data: ${e}`);
    res.sendStatus(500);
  }
}
