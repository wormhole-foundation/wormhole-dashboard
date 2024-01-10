import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Storage } from '@google-cloud/storage';
import { ObservedMessage } from './types';
import { assertEnvironmentVariable } from './utils';

// Read from cloud storage
const storage = new Storage();

export type MissingVaasByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastRowKey: string;
    lastUpdated: number;
  };
};

export async function commonGetMissingVaas(): Promise<MissingVaasByChain> {
  // The ID of your GCS bucket
  let bucketName: string = 'wormhole-observed-blocks-cache';
  if (assertEnvironmentVariable('NETWORK') === 'TESTNET') {
    bucketName = 'wormhole-observed-blocks-cache-testnet';
  }
  const cacheBucket = storage.bucket(bucketName);
  const cacheFileName = 'missing-vaas-cache.json';
  const cloudStorageCache = cacheBucket.file(cacheFileName);
  const [csCache] = await cloudStorageCache.download();
  return JSON.parse(csCache.toString());
}

export async function getMissingVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  let messages: MissingVaasByChain = {};
  try {
    messages = await commonGetMissingVaas();
    res.status(200).send(JSON.stringify(messages));
  } catch (e) {
    res.sendStatus(500);
  }
}
