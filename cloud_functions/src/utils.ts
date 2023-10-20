import axios from 'axios';

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

// This function expects the following environment variables to be set:
// SLACK_CHANNEL_ID
// SLACK_POST_URL
// SLACK_BOT_TOKEN
export async function formatAndSendToSlack(msg: string): Promise<any> {
  const SLACK_CHANNEL_ID = assertEnvironmentVariable('SLACK_CHANNEL_ID');
  const SLACK_POST_URL = assertEnvironmentVariable('SLACK_POST_URL');
  const SLACK_BOT_TOKEN = assertEnvironmentVariable('SLACK_BOT_TOKEN');
  // Construct the payload
  const payload = {
    channel: SLACK_CHANNEL_ID,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Wormhole Missing VAA Alarm*',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: msg,
        },
      },
    ],
  };

  // Send to slack channel
  const AXIOS_NUM_RETRIES = 1;
  const AXIOS_RETRY_TIME_IN_MILLISECONDS = 250;
  let response = null;
  const url = SLACK_POST_URL;
  for (let i = 0; i < AXIOS_NUM_RETRIES; ++i) {
    try {
      response = await axios.post(url, payload, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
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

export async function isVAASigned(vaaKey: string): Promise<boolean> {
  const url: string = WormholescanRPC + 'v1/signed_vaa/1/' + vaaKey;
  try {
    const response = await axios.get(url);
    // curl -X 'GET' \
    // 'https://api.wormholescan.io/v1/signed_vaa/1/ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5/319118' \
    // -H 'accept: application/json'
    // This function will return true if the get returns 200
    // Otherwise, it will return false
    if (response.status === 200) {
      return true;
    }
  } catch (e) {
    console.error('Failed to query wormholescan with url', +url + "'", e);
    return false;
  }
  return false;
}
