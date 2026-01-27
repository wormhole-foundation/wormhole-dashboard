import { Storage } from '@google-cloud/storage';
import { ChainId } from '@wormhole-foundation/sdk-base';
import {
  assertEnvironmentVariable,
  isChainDeprecated,
} from '@wormhole-foundation/wormhole-monitor-common';

// Read from cloud storage
const storage = new Storage();

export type CountsByChain = {
  [chain in ChainId]?: {
    numTotalMessages: number;
    numMessagesWithoutVaas: number;
    lastRowKey: string;
    firstMissingVaaRowKey: string;
  };
};

export async function getMessageCounts(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  let messages: CountsByChain = {};
  try {
    // The ID of your GCS bucket
    let bucketName: string = 'wormhole-observed-blocks-cache';
    if (assertEnvironmentVariable('NETWORK') === 'TESTNET') {
      bucketName = 'wormhole-observed-blocks-cache-testnet';
    }
    const cacheBucket = storage.bucket(bucketName);
    const cacheFileName = 'message-counts-cache.json';
    const cloudStorageCache = cacheBucket.file(cacheFileName);
    const [csCache] = await cloudStorageCache.download();
    messages = JSON.parse(csCache.toString())?.messages;
    const filteredMessages: CountsByChain = {};
    for (const [chain, data] of Object.entries(messages)) {
      const chainId = Number(chain);
      if (isChainDeprecated(chainId)) continue;
      filteredMessages[chainId as ChainId] = data;
    }
    res.status(200).send(JSON.stringify(filteredMessages));
  } catch (e) {
    res.sendStatus(500);
  }
}
