import { ChainId, Network, encoding, toChainId } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import axios from 'axios';
import { Mode } from './consts';
import { PagerDutyInfo, SlackInfo } from './types';

export async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
export const assertEnvironmentVariable = (varName: string) => {
  if (varName in process.env) return process.env[varName]!;
  throw new Error(`Missing required environment variable: ${varName}`);
};
export const MAX_UINT_16 = '65535';
export const padUint16 = (s: string): string => s.padStart(MAX_UINT_16.length, '0');
export const MAX_UINT_64 = '18446744073709551615';
export const padUint64 = (s: string): string => s.padStart(MAX_UINT_64.length, '0');

// make a bigtable row key for the `signedVAAs` table
export const makeSignedVAAsRowKey = (chain: number, emitter: string, sequence: string): string =>
  `${padUint16(chain.toString())}/${emitter}/${padUint64(sequence)}`;

export function getNetwork(): Network {
  const network: string = assertEnvironmentVariable('NETWORK').toLowerCase();
  if (network === 'mainnet') {
    return 'Mainnet';
  }
  if (network === 'testnet') {
    return 'Testnet';
  }
  if (network === 'devnet') {
    return 'Devnet';
  }
  throw new Error(`Unknown network: ${network}`);
}

export function getMode(): Mode {
  const mode: string = assertEnvironmentVariable('MODE').toLowerCase();
  if (mode === 'vaa' || mode === 'ntt' || mode === 'ft') {
    return mode;
  }
  throw new Error(`Unknown mode: ${mode}`);
}

// This function basically strips off the `0x` prefix from the hex string.
export function universalAddress_stripped(u: UniversalAddress): string {
  return encoding.hex.encode(u.toUint8Array());
}

// This function takes a Chain or a ChainId as a string and returns
// the corresponding ChainId (or undefined if the chain is not recognized).
export function stringToChainId(input: string): ChainId | undefined {
  try {
    if (Number.isNaN(Number(input))) {
      return toChainId(input);
    }
    return toChainId(Number(input));
  } catch (e) {
    return undefined;
  }
}

// Bigtable Message ID format
// chain/MAX_UINT64-block/emitter/sequence
// 00002/00000000000013140651/0000000000000000000000008ea8874192c8c715e620845f833f48f39b24e222/00000000000000000000

export function makeMessageId(
  chainId: number,
  block: string,
  emitter: string,
  sequence: string
): string {
  return `${padUint16(chainId.toString())}/${padUint64(
    (BigInt(MAX_UINT_64) - BigInt(block)).toString()
  )}/${emitter}/${padUint64(sequence)}`;
}

export function parseMessageId(id: string): {
  chain: number;
  block: number;
  emitter: string;
  sequence: bigint;
} {
  const [chain, inverseBlock, emitter, sequence] = id.split('/');
  return {
    chain: parseInt(chain),
    block: Number(BigInt(MAX_UINT_64) - BigInt(inverseBlock)),
    emitter,
    sequence: BigInt(sequence),
  };
}

export const WormholescanRPC: { [key in Network]?: string } = {
  ['Mainnet']: 'https://api.wormholescan.io/',
  ['Testnet']: 'https://api.testnet.wormholescan.io/',
  ['Devnet']: '',
};

export async function formatAndSendToSlack(info: SlackInfo): Promise<any> {
  // Construct the payload
  const payload = {
    channel: info.channelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${info.bannerTxt}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: info.msg,
        },
      },
    ],
  };

  // Send to slack channel
  const AXIOS_NUM_RETRIES = 1;
  const AXIOS_RETRY_TIME_IN_MILLISECONDS = 250;
  let response = null;
  const url = info.postUrl;
  for (let i = 0; i < AXIOS_NUM_RETRIES; ++i) {
    try {
      response = await axios.post(url, payload, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${info.botToken}`,
        },
      });
      break;
    } catch (error) {
      console.error(
        `axios error with post request: ${url}. trying again in ${AXIOS_RETRY_TIME_IN_MILLISECONDS}ms.`
      );
      console.error(error);
      await sleep(AXIOS_RETRY_TIME_IN_MILLISECONDS);
    }
  }

  if (response === null) {
    throw Error('error with axios.post');
  }
  const responseData = response.data.data;
  return responseData;
}

export async function isVAASigned(network: Network, vaaKey: string): Promise<boolean> {
  const url: string =
    WormholescanRPC[network] + 'v1/signed_vaa/' + vaaKey + '?network=' + network.toUpperCase();
  try {
    const response = await axios.get(url);
    // curl -X 'GET' \
    // 'https://api.wormholescan.io/v1/signed_vaa/1/ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5/319118' \
    // -H 'accept: application/json'
    // This function will return true if the GET returns 200
    // Otherwise, it will return false
    if (response.status === 200) {
      return true;
    }
  } catch (e) {
    console.error(`Failed to query wormholescan with url [${url}]`);
    return false;
  }
  return false;
}

export async function sendToPagerDuty(info: PagerDutyInfo): Promise<any> {
  // Construct the payload
  const payload = {
    summary: info.summary,
    severity: 'critical',
    source: info.source,
  };

  // Construct the data section
  const data = {
    payload,
    routing_key: info.routingKey,
    event_action: 'trigger',
  };

  // Send to pagerduty
  const AXIOS_NUM_RETRIES = 1;
  const AXIOS_RETRY_TIME_IN_MILLISECONDS = 250;
  let response = null;
  for (let i = 0; i <= AXIOS_NUM_RETRIES; ++i) {
    try {
      response = await axios.post(info.url, data, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
        },
      });
      break;
    } catch (error) {
      console.error(
        `axios error with post request: ${info.url}. trying again in ${AXIOS_RETRY_TIME_IN_MILLISECONDS}ms.`
      );
      console.error(error);
      await sleep(AXIOS_RETRY_TIME_IN_MILLISECONDS);
    }
  }

  if (response === null) {
    throw Error('error with axios.post');
  }
  return response.data.data;
}

// Retry utility function
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  retryCount = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retryCount >= retries) {
      console.error(`Failed after ${retries} retries:`, error);
      throw error;
    } else {
      console.warn(`Retrying (${retryCount + 1}/${retries})...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay * (retryCount + 1)));
      return retry(fn, retries, delay, retryCount + 1);
    }
  }
}

export function stringifyWithBigInt(obj: any) {
  return JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function isChainDeprecated(chainId: number): boolean {
  const deprecatedChains = [3, 7, 9, 10, 11, 12, 13, 17, 18, 25, 28, 33, 35, 36, 37, 43, 49];
  return deprecatedChains.includes(chainId);
}
