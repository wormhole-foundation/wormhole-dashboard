import { Storage } from '@google-cloud/storage';
import {
  NTTRateLimit,
  assertEnvironmentVariable,
} from '@wormhole-foundation/wormhole-monitor-common';

const storage = new Storage();
const network = assertEnvironmentVariable('NETWORK');
let bucketName: string = 'wormhole-ntt-cache';
if (network === 'Testnet') {
  bucketName = 'wormhole-ntt-cache-testnet';
}
const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'ntt-total-supply-and-locked.json';
const cloudStorageCache = cacheBucket.file(cacheFileName);

export async function getTotalSupplyAndLocked(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  let rateLimits: NTTRateLimit[] = [];
  try {
    const [csCache] = await cloudStorageCache.download();
    rateLimits = JSON.parse(csCache.toString());

    res.json(rateLimits);
    return;
  } catch (e) {
    console.error('Error getting rate limits: ', e);
    res.sendStatus(500);
  }
}
