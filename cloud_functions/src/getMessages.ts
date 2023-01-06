import { Bigtable } from '@google-cloud/bigtable';
import { ChainId, CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16, assertEnvironmentVariable, padUint64, parseMessageId } from './utils';
import { pathToRegexp } from 'path-to-regexp';
import {
  ObservedEvent,
  ObservedMessage,
  ObservedMessageResponse,
  MessagesByChain,
  makeCache,
} from './types';

let noVaaCache: MessagesByChain = makeCache();

function validChain(chain: string) {
  try {
    if (Object.values(CHAINS).indexOf(Number(chain) as ChainId) > -1) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}

async function getMessages_(
  chainId: number,
  numMessages: number,
  fromKey: string
): Promise<ObservedMessageResponse> {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const table = instance.table(assertEnvironmentVariable('BIGTABLE_TABLE_ID'));
  let messages: ObservedMessage[] = [];
  let lastRowKey = fromKey;
  try {
    const prefix = `${padUint16(chainId.toString())}/`;
    let start = fromKey === undefined ? prefix : fromKey;
    let end = `${padUint16((chainId + 1).toString())}/`;
    var [observedMessages] = await table.getRows({
      limit: fromKey ? numMessages + 1 : numMessages,
      ranges: [
        {
          start,
          end,
        },
      ],
    });

    const filteredMessages: ObservedEvent[] = observedMessages.filter((o) => o?.id !== start);

    for (const message of filteredMessages.slice(0, numMessages)) {
      if (message) {
        const { chain, block, emitter, sequence } = parseMessageId(message.id);
        const { timestamp, txHash, hasSignedVaa } = message.data.info;
        messages.push({
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

    lastRowKey = messages[0]?.id || fromKey;
  } catch (e) {
    console.error(e);
  }

  return {
    messages: messages.slice(0, NUM_ROWS),
    lastUpdated: Date.now(),
    lastRowKey: lastRowKey,
  };
}

async function getMessagesNoSignedVaa_(
  chainId: number,
  numMessages: number,
  prevMissingVaaKey: string
): Promise<ObservedMessageResponse> {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const table = instance.table(assertEnvironmentVariable('BIGTABLE_TABLE_ID'));
  let blockIncrement = BLOCK_INCREMENT;
  let messages: ObservedMessage[] = [];
  let firstMissingVaaKey = prevMissingVaaKey;
  try {
    const prefix = `${padUint16(chainId.toString())}/`;
    // if lastKey is empty, start with prefix
    let start = prefix;
    let end =
      firstMissingVaaKey === '' ? `${padUint16((chainId + 1).toString())}/` : firstMissingVaaKey;
    // retrieve rows starting from lastKey to the start of the next chain's rows
    do {
      var [observedMessages] = await table.getRows({
        ranges: [
          {
            start,
            end,
          },
        ],
      });

      const filteredMessages: ObservedEvent[] = observedMessages.filter(
        (m) => m.data.info.hasSignedVaa[0].value === 0
      );
      for (const message of filteredMessages.slice(0, numMessages)) {
        if (message) {
          const { chain, block, emitter, sequence } = parseMessageId(message.id);
          const { timestamp, txHash, hasSignedVaa } = message.data.info;
          messages.push({
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
      let startBlock = start !== prefix ? start.split('/')[1] : undefined;
      // break if startBlock is undefined (the initial load), already below the initial deployment block or if no messages
      if (startBlock === undefined || filteredMessages.length === 0) {
        // firstMissingVaaKey is the earliest message without a vaa, the most recent observedMessage, or if both
        // are undefined, use the prevMissingVaaKey
        firstMissingVaaKey =
          messages[messages.length - 1]?.id || observedMessages[0]?.id || prevMissingVaaKey;
        break;
      } else {
        // loop backwards if there aren't enough missing vaas found
        let prevBlock =
          BigInt(startBlock) - BigInt(blockIncrement) >= 0
            ? BigInt(startBlock) - BigInt(blockIncrement)
            : '0';
        start = `${padUint16(chainId.toString())}/${padUint64(prevBlock.toString())}`;
        console.log(start);
        firstMissingVaaKey =
          messages[messages.length - 1]?.id || observedMessages[0]?.id || prevMissingVaaKey;
      }
      // try increasing block increment each pass
      blockIncrement *= 2;
    } while (messages.length < numMessages && true);
  } catch (e) {
    console.error(e);
  }

  return {
    messages: messages.slice(0, NUM_ROWS),
    lastUpdated: Date.now(),
    lastRowKey: firstMissingVaaKey,
  };
}

// default refresh interval = 60 sec
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 1;
// default to return 100 latest messages by chain
const NUM_ROWS = Number(process.env.CLOUD_FUNCTIONS_NUM_ROWS) || 100;
const BLOCK_INCREMENT = Number(process.env.CLOUD_FUNCTIONS_BLOCK_INCREMENT) || 10_000;
/*
  The getMessages endpoint has 1 path param: chain id - required and multiple query params: 
    (1) missingVaa - true/false
    (2) fromId - rowKey or prefix to start at for getRows()
    (3) reloadCache - true/false to reload the noVaaCache

  if only chain is provided, the last numMessages will be returned regardless of hasSignedVaa status in descending order of timestamp
  if chain and missingVaa=true are used, then the rows will be filtered for hasSignedVaa=1

  There is one cache: noVaaCache. It is keyed by ChainId and contains messages, last updated timestamp, and first missing vaa row key. 
  The cache is refreshed when the difference of current timestamp and last update timestamp is greater than refreshTimeInterval.
  When the cache is intially loaded, all of that chain's rows are retrieved and the latest "numMessages" messages returned. Each subsequent
  refresh first finds the most recent rows until first missing vaa row key.
*/
export async function getMessages(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  const { missingVaa, fromId, reloadCache } = req.query;
  if (
    missingVaa !== undefined &&
    missingVaa !== 'true' &&
    missingVaa !== '1' &&
    missingVaa !== 'false' &&
    missingVaa !== '0'
  ) {
    res
      .status(400)
      .send(
        'incorrect value for query param: missingVaa\n. Use missingVaa=true or missingVaa=false'
      );
    return;
  }
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

  if (reloadCache === 'true' || reloadCache === '1') {
    console.log('emptying the caches');
    noVaaCache = makeCache();
  }

  var keys: never[] = [];
  var re = pathToRegexp('/:chain', keys, {
    strict: false,
  });
  var pathVars = re.exec(req.path);
  let chain: string | undefined = undefined;
  if (pathVars) {
    chain = pathVars[1];
    console.log(chain);
    let chainId: ChainId;
    if (validChain(chain)) {
      chainId = Number(chain) as ChainId;

      let messageResponse: ObservedMessageResponse = {
        messages: [],
        lastUpdated: Date.now(),
        lastRowKey: '',
      };
      let messages: ObservedMessage[] = [];
      let lastRowKey: string = '';

      if (missingVaa === 'true' || missingVaa === '1') {
        if (
          noVaaCache[chainId]['messages'].length === 0 ||
          Date.now() - noVaaCache[chainId]['lastUpdated'] > REFRESH_TIME_INTERVAL
        ) {
          if (noVaaCache[chainId]['messages'].length === 0) {
            console.log(`noVaaCache is empty, setting cache['messages] ${new Date()}`);
          } else {
            console.log(
              `noVaaCache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`
            );
          }
          let prevDate = Date.now();
          lastRowKey = noVaaCache[chainId]['lastRowKey'];
          messageResponse = await getMessagesNoSignedVaa_(chainId, NUM_ROWS, lastRowKey);
          console.log('In noVaaCache, after getMessages_=', Date.now() - prevDate);
          messages = messageResponse['messages'];
          noVaaCache[chainId] = messageResponse;
        } else {
          // console.log(`noVaaCache is still valid, not refreshing ${new Date()}`);
          messages = noVaaCache[chainId]['messages'];
        }
      } else {
        let prevDate = Date.now();
        messageResponse = await getMessages_(chainId, NUM_ROWS, fromId);
        console.log('In cache, after getMessages_=', Date.now() - prevDate);
        messages = messageResponse['messages'];
      }
      res.status(200).send(JSON.stringify(messages));
    } else {
      res.status(400).send(`${chain} is not a valid chain`);
    }
  } else {
    res.status(400).send('No chain specified');
  }
}
