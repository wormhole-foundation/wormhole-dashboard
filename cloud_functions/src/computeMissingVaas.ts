import { Bigtable } from '@google-cloud/bigtable';
import { ChainId, CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16, assertEnvironmentVariable, parseMessageId } from './utils';
import { Storage } from '@google-cloud/storage';
import { ObservedMessage } from './types';

// Read/write to cloud storage
const storage = new Storage();
const bucketName = 'observed-blocks-cache';
const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'missing-vaas-cache.json';
// The ID of your GCS bucket
const cloudStorageCache = cacheBucket.file(cacheFileName);

export type MissingVaasByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastRowKey: string;
    lastUpdated: number;
  };
};

async function getMissingVaas_(prevMissingVaas: MissingVaasByChain): Promise<MissingVaasByChain> {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const table = instance.table(assertEnvironmentVariable('BIGTABLE_TABLE_ID'));
  console.log(
    assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'),
    assertEnvironmentVariable('BIGTABLE_TABLE_ID')
  );
  // build range values for each chain based on first missing vaa row key
  let missingVaaRanges: { ranges: { start: string; end: string }[] } = {
    ranges: [],
  };

  for (const [chainName, chainId] of Object.entries(CHAINS)) {
    //(const [prevChain, prevData] of Object.entries(prevMissingVaas)) {
    const prevData = prevMissingVaas[chainId];
    const startRowKey = `${padUint16(Number(chainId).toString())}/`;
    const endMissingVaaRowKey = prevData?.lastRowKey || padUint16((Number(chainId) + 1).toString());

    // TODO: use inclusive/exclusive?
    missingVaaRanges['ranges'].push({ start: startRowKey, end: endMissingVaaRowKey });
  }
  let missingMessages: MissingVaasByChain = {};
  const [missingVaaObservedMessages] = await table.getRows(missingVaaRanges);
  for (const [chainName, chainId] of Object.entries(CHAINS)) {
    console.log(chainName, chainId);
    let lastRowKey = '';
    let missingMessagesByChain: ObservedMessage[] = [];
    const messagesByChain = missingVaaObservedMessages.filter(
      (m) => m.id.split('/')[0] === padUint16(chainId.toString())
    );

    // separate messages by chains and filter by missing vaas
    const missingVaaMessagesByChain = messagesByChain.filter(
      (m) => m.data.info.hasSignedVaa[0].value === 0
    );
    if (missingVaaMessagesByChain.length !== 0) {
      for (const message of missingVaaMessagesByChain) {
        if (message) {
          const { chain, block, emitter, sequence } = parseMessageId(message.id);
          const { timestamp, txHash, hasSignedVaa } = message.data.info;
          missingMessagesByChain.push({
            id: message.id,
            chain: chain,
            block: block,
            emitter: emitter,
            seq: sequence.toString(),
            timestamp: timestamp[0].value,
            txHash: txHash[0].value,
            hasSignedVaa: hasSignedVaa[0].value,
          });
        }
      }

      lastRowKey = missingVaaMessagesByChain[missingVaaMessagesByChain.length - 1]?.id;
    } else {
      console.log('no missing vaas');
    }
    // update counts
    if (lastRowKey === '') {
      lastRowKey = messagesByChain[0]?.id;
    }
    missingMessages[chainId] = {
      messages: missingMessagesByChain,
      lastUpdated: Date.now(),
      lastRowKey: lastRowKey,
    };
  }
  return missingMessages;
}

export async function computeMissingVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  const { reloadCache } = req.query;
  if (
    reloadCache !== undefined &&
    reloadCache !== 'true' &&
    reloadCache !== '1' &&
    reloadCache !== 'false' &&
    reloadCache !== '0'
  ) {
    res
      .status(400)
      .send(
        'incorrect value for query param: reloadCache\n. Use reloadCache=true or reloadCache=false'
      );
    return;
  }
  let cache = { messages: {} as MissingVaasByChain };

  if (reloadCache === 'true' || reloadCache === '1') {
    console.log('emptying the caches');
    cache = { messages: {} as MissingVaasByChain };
  } else {
    console.log('loading from cache bucket');
    const [csCache] = await cloudStorageCache.download();
    cache = { messages: JSON.parse(csCache.toString()) };
  }

  let messages: MissingVaasByChain = {};
  try {
    messages = await getMissingVaas_(cache['messages']);
    cache['messages'] = messages;
    await cloudStorageCache.save(JSON.stringify(messages));
    res.status(200).send('successfully uploaded cache to bucket');
  } catch (e) {
    console.log('could not refresh missing vaa cache');
    res.sendStatus(500);
  }
  return;
}
