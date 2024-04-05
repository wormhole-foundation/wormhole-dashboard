import axios from 'axios';
import { PagerDutyInfo, SlackInfo } from './types';
import { Network } from '@wormhole-foundation/sdk-base';

export async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
export const assertEnvironmentVariable = (varName: string) => {
  if (varName in process.env) return process.env[varName]!;
  throw new Error(`Missing required environment variable: ${varName}`);
};
const MAX_UINT_16 = '65535';
export const padUint16 = (s: string): string => s.padStart(MAX_UINT_16.length, '0');
const MAX_UINT_64 = '18446744073709551615';
export const padUint64 = (s: string): string => s.padStart(MAX_UINT_64.length, '0');

export const WormholescanRPC: string = 'https://api.wormholescan.io/';

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
    WormholescanRPC + 'v1/signed_vaa/' + vaaKey + '?network=' + network.toUpperCase();
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
