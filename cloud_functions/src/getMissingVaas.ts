import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Storage } from '@google-cloud/storage';
import { ObservedMessage } from './types';

// Read from cloud storage
const storage = new Storage();

export type MissingVaasByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastRowKey: string;
    lastUpdated: number;
  };
};

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
    // The ID of your GCS bucket
    const bucketName = 'observed-blocks-cache';
    const cacheBucket = storage.bucket(bucketName);
    const cacheFileName = 'missing-vaas-cache.json';

    const cloudStorageCache = cacheBucket.file(cacheFileName);
    const [csCache] = await cloudStorageCache.download();
    messages = JSON.parse(csCache.toString());
    res.status(200).send(JSON.stringify(messages));
  } catch (e) {
    res.sendStatus(500);
  }
}
