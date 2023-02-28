import { assertEnvironmentVariable, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

async function postSlackMessage(url: string, data: any): Promise<any> {
  const AXIOS_NUM_RETRIES = 1;
  const AXIOS_RETRY_TIME_IN_MILLISECONDS = 250;
  let response = null;
  for (let i = 0; i < AXIOS_NUM_RETRIES; ++i) {
    try {
      response = await axios.post(url, data, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
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

export async function formatAndSendToSlack(header: string, msg: string) {
  const payload = {
    channel: assertEnvironmentVariable('SLACK_CHANNEL_MONITOR'),
    text: msg,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: header,
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
  await postSlackMessage(assertEnvironmentVariable('SLACK_MONITOR_URL'), payload);
}
