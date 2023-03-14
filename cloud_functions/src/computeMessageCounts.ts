import { Bigtable } from '@google-cloud/bigtable';
import { ChainId, CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16, assertEnvironmentVariable } from './utils';
import { Storage } from '@google-cloud/storage';

// Read/write with cloud storage
const storage = new Storage();
// The ID of your GCS bucket
const bucketName = 'observed-blocks-cache';
const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'message-counts-cache.json';
const cloudStorageCache = cacheBucket.file(cacheFileName);

export type CountsByChain = {
  [chain in ChainId]?: {
    numTotalMessages: number;
    numMessagesWithoutVaas: number;
    lastRowKey: string;
    firstMissingVaaRowKey: string;
  };
};

async function getMessageCounts_(prevMessageCounts: CountsByChain): Promise<CountsByChain> {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const table = instance.table(assertEnvironmentVariable('BIGTABLE_TABLE_ID'));

  // build range values for each chain based on last row key
  let ranges: { ranges: { start: string; end: string }[] } = {
    ranges: [],
  };

  // build range values for each chain based on first missing vaa row key
  let missingVaaRanges: { ranges: { start: string; end: string }[] } = {
    ranges: [],
  };

  for (const [prevChain, prevData] of Object.entries(prevMessageCounts)) {
    const startRowKey = `${padUint16(Number(prevChain).toString())}/`;
    const endMissingVaaRowKey =
      prevData.firstMissingVaaRowKey || padUint16((Number(prevChain) + 1).toString());
    const endRowKey = prevData.lastRowKey || padUint16((Number(prevChain) + 1).toString());

    // TODO: use inclusive/exclusive?
    ranges['ranges'].push({ start: startRowKey, end: endRowKey });
    missingVaaRanges['ranges'].push({ start: startRowKey, end: endMissingVaaRowKey });
  }

  let messageCounts: CountsByChain = {};
  const [observedMessages] = await table.getRows(ranges);
  const [missingVaaObservedMessages] = await table.getRows(missingVaaRanges);

  for (const [chainName, chainId] of Object.entries(CHAINS)) {
    const prevData = prevMessageCounts[chainId];
    const prevRowKey = prevData?.lastRowKey || '';
    const prevTotalMessages = prevData?.numTotalMessages || 0;

    // separate messages by chains
    const messagesByChain = observedMessages.filter(
      (m) => m.id.split('/')[0] === padUint16(chainId.toString())
    );

    // separate messages by chains and filter by missing vaas
    const missingVaaMessagesByChain = missingVaaObservedMessages
      .filter((m) => m.id.split('/')[0] === padUint16(chainId.toString()))
      .filter((m) => m.data.info.hasSignedVaa[0].value === 0);
    const lastRowKey = messagesByChain.length === 0 ? prevRowKey : messagesByChain[0].id;

    // don't double count last row key
    const filteredMessagesByChain = messagesByChain.filter((m) => m.id !== prevRowKey);

    const numTotalMessages = filteredMessagesByChain.length;
    const numMessagesWithoutVaas = missingVaaMessagesByChain.length;
    // update counts
    messageCounts[chainId] = {
      numTotalMessages: numTotalMessages + prevTotalMessages,
      numMessagesWithoutVaas: numMessagesWithoutVaas,
      lastRowKey: lastRowKey,
      firstMissingVaaRowKey:
        missingVaaMessagesByChain[missingVaaMessagesByChain.length - 1]?.id || lastRowKey, // use lastRowKey if no missing vaas found
    };
  }
  return messageCounts;
}

export async function computeMessageCounts(req: any, res: any) {
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
  let cache = { messages: {} as CountsByChain, lastUpdated: Date.now() };

  if (reloadCache === 'true' || reloadCache === '1') {
    console.log('emptying the caches');
    cache = { messages: {} as CountsByChain, lastUpdated: Date.now() };
  } else {
    console.log('loading from cache bucket');
    const [csCache] = await cloudStorageCache.download();
    cache = JSON.parse(csCache.toString());
  }

  let messages: CountsByChain = {};
  try {
    messages = await getMessageCounts_(cache['messages']);
    cache['messages'] = messages;
    cache['lastUpdated'] = Date.now();
    await cloudStorageCache.save(JSON.stringify(cache));
    res.status(200).send('successfully uploaded message count cache to bucket');
  } catch (e) {
    console.log('could not refresh message count cache');
    res.sendStatus(500);
  }
  return;
}
