import { Bigtable } from '@google-cloud/bigtable';
import { ChainId, CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16, assertEnvironmentVariable } from './utils';

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
  // let date1 = Date.now();
  const [observedMessages] = await table.getRows(ranges);
  // console.log('after 1st getRows', Date.now() - date1);
  // let date2 = Date.now();
  const [missingVaaObservedMessages] = await table.getRows(missingVaaRanges);
  // console.log('after 2nd getRows', Date.now() - date2);

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

let cache = { messages: {} as CountsByChain, lastUpdated: Date.now() };
// default refresh interval = 60 sec
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 1;

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
    if (
      Object.keys(cache['messages']).length === 0 ||
      Date.now() - cache['lastUpdated'] > REFRESH_TIME_INTERVAL
    ) {
      if (Object.keys(cache['messages']).length === 0) {
        console.log(`cache is empty, setting cache['messages] ${new Date()}`);
      } else {
        console.log(`cache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`);
      }
      let prevDate = Date.now();
      messages = await getMessageCounts_(cache['messages']);
      let timeDiff = Date.now() - prevDate;
      console.log('After getMessageCounts_=', timeDiff);
      cache['messages'] = messages;
      cache['lastUpdated'] = Date.now();
    } else {
      // console.log(`cache is still valid, not refreshing ${new Date()}`);
      messages = cache['messages'];
    }
    res.status(200).send(JSON.stringify(messages));
  } catch (e) {
    res.sendStatus(500);
  }
}
