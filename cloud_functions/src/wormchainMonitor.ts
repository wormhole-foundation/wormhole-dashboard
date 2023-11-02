import axios from 'axios';
import { assertEnvironmentVariable, formatAndSendToSlack, sendToPagerDuty } from './utils';
import { PagerDutyInfo, SlackInfo } from './types';
import { evmosRPCs } from './data/evmosRPCs.json';
import { osmosisRPCs } from './data/osmosisRPCs.json';
import { kujiraRPCs } from './data/kujiraRPCs.json';

type ClientRPC = {
  address: string;
  provider: string;
};

type ClientInfo = {
  chain: string;
  wormchainClientId: string;
  foreignChainClientID: string;
  foreignChainURLs: ClientRPC[];
};

type RetrievedInfo = {
  trustingPeriodInSeconds: number;
  revisionHeight: number;
};

const WormchainRPCs: ClientRPC[] = [
  { address: 'https://wormchain-lcd.quickapi.com/', provider: 'ChainLayer' },
];
const CLIENT_STATE_QUERY: string = 'ibc/core/client/v1/client_states/';
const BLOCK_QUERY: string = 'cosmos/base/tendermint/v1beta1/blocks/';

const chainInfos: ClientInfo[] = [
  {
    chain: 'osmosis',
    wormchainClientId: '07-tendermint-8',
    foreignChainClientID: '07-tendermint-2927',
    foreignChainURLs: osmosisRPCs,
  },
  {
    chain: 'evmos',
    wormchainClientId: '07-tendermint-10',
    foreignChainClientID: '07-tendermint-119',
    foreignChainURLs: evmosRPCs,
  },
  {
    chain: 'kujira',
    wormchainClientId: '07-tendermint-13',
    foreignChainClientID: '07-tendermint-153',
    foreignChainURLs: kujiraRPCs,
  },
];

const PAGER_DUTY_THRESHOLD: number = 2 / 3;
const PAGER_DUTY_THRESHOLD_DISPLAY: string = '2/3';
const SLACK_THRESHOLD: number = 0.5;
const SLACK_THRESHOLD_DISPLAY: string = '50%';
const AUTO_REFRESH_THRESHOLD: number = 0.25;
const AUTO_REFRESH_THRESHOLD_DISPLAY: string = '25%';

export async function wormchainMonitor(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  const warningSlackInfo: SlackInfo = {
    channelId: assertEnvironmentVariable('WORMCHAIN_SLACK_CHANNEL_ID'),
    postUrl: assertEnvironmentVariable('WORMCHAIN_SLACK_POST_URL'),
    botToken: assertEnvironmentVariable('WORMCHAIN_SLACK_BOT_TOKEN'),
    bannerTxt: 'Pending light client expiration',
    msg: '',
  };

  const alarmPagerDutyInfo: PagerDutyInfo = {
    url: assertEnvironmentVariable('WORMCHAIN_PAGERDUTY_URL'),
    routingKey: assertEnvironmentVariable('WORMCHAIN_PAGERDUTY_ROUTING_KEY'),
    source: 'wormchainMonitor cloud function',
    summary: '',
  };

  try {
    for (const info of chainInfos) {
      // Get foreign chain info
      const fcClient: RetrievedInfo = await getClientInfo(WormchainRPCs, info.wormchainClientId);
      // Get wormchain info
      const wcClient: RetrievedInfo = await getClientInfo(
        info.foreignChainURLs,
        info.foreignChainClientID
      );
      // Get foreign chain block time of revision height
      const fcBlockTime: number = await getBlockTime(
        info.foreignChainURLs,
        fcClient.revisionHeight
      );
      // Get wormchain block time of revision height
      const wcBlockTime: number = await getBlockTime(WormchainRPCs, wcClient.revisionHeight);

      // Calculate thresholds
      const fcAutoRefreshThreshold: number =
        fcBlockTime + Math.floor(fcClient.trustingPeriodInSeconds * AUTO_REFRESH_THRESHOLD);
      const fcSlackThreshold: number =
        fcBlockTime + Math.floor(fcClient.trustingPeriodInSeconds * SLACK_THRESHOLD);
      const fcPagerThreshold: number =
        fcBlockTime + Math.floor(fcClient.trustingPeriodInSeconds * PAGER_DUTY_THRESHOLD);
      const wcAutoRefreshThreshold: number =
        wcBlockTime + Math.floor(wcClient.trustingPeriodInSeconds * AUTO_REFRESH_THRESHOLD);
      const wcSlackThreshold: number =
        wcBlockTime + Math.floor(wcClient.trustingPeriodInSeconds * SLACK_THRESHOLD);
      const wcPagerThreshold: number =
        wcBlockTime + Math.floor(wcClient.trustingPeriodInSeconds * PAGER_DUTY_THRESHOLD);

      // Now as the number of seconds since 1970
      const now: number = Math.floor(Date.now() / 1000); // in seconds

      if (now >= fcPagerThreshold || now >= wcPagerThreshold) {
        console.error(`Pager threshold exceeded for connection: wormchain <-> ${info.chain}`);
        alarmPagerDutyInfo.summary = `${info.chain} <-> wormchain is more than ${PAGER_DUTY_THRESHOLD_DISPLAY} through its trusting period.`;
        await sendToPagerDuty(alarmPagerDutyInfo);
      }
      // This check will send to slack for both the slack and pager thresholds exceeded.
      if (now >= fcSlackThreshold || now >= wcSlackThreshold) {
        console.error(`Slack threshold exceeded for connection: wormchain <-> ${info.chain}`);
        warningSlackInfo.msg = `${info.chain} <-> wormchain is more than ${SLACK_THRESHOLD_DISPLAY} through its trusting period.`;
        await formatAndSendToSlack(warningSlackInfo);
      }
      // Check to see if we need to automatically refresh the foreign chain
      if (now >= fcAutoRefreshThreshold) {
        console.error(`Auto refresh threshold exceeded for ${info.chain}`);
        warningSlackInfo.msg = `${info.chain} <-> wormchain is more than ${AUTO_REFRESH_THRESHOLD_DISPLAY} through its trusting period.`;
        await formatAndSendToSlack(warningSlackInfo);
        await refreshLightClient(info.foreignChainURLs[0], info.foreignChainClientID);
      }
      // Check to see if we need to automatically refresh wormchain
      if (now >= wcAutoRefreshThreshold) {
        console.error(
          `Auto refresh threshold exceeded for wormchain side of connection with ${info.chain}`
        );
        warningSlackInfo.msg = `${info.chain} <-> wormchain is more than ${AUTO_REFRESH_THRESHOLD_DISPLAY} through its trusting period.`;
        await formatAndSendToSlack(warningSlackInfo);
        await refreshLightClient(WormchainRPCs[0], info.wormchainClientId);
      }
    }
  } catch (e) {
    console.error('Failed to monitor wormchain:', e);
    res.sendStatus(500);
  }
  res.status(200).send('successfully monitored wormchain');
}

async function getClientInfo(rpcs: ClientRPC[], channelId: string): Promise<RetrievedInfo> {
  for (const rpc of rpcs) {
    const completeURL: string = rpc.address + CLIENT_STATE_QUERY + channelId;
    console.log('getClientInfo URL: ' + completeURL);
    let response: any;
    try {
      response = await axios.get(completeURL);
    } catch (error) {
      console.error(error);
      continue;
    }
    const info: ChainInfoResponse = response.data;
    return {
      trustingPeriodInSeconds: parseInt(info.client_state.trusting_period),
      revisionHeight: parseInt(info.client_state.latest_height.revision_height),
    };
  }
  throw Error('Unable to query any RPCs');
}

async function getBlockTime(rpcs: ClientRPC[], height: number): Promise<number> {
  // Returns the block time in seconds
  for (const rpc of rpcs) {
    const completeURL: string = rpc.address + BLOCK_QUERY + height;
    console.log('getBlockTime URL: ' + completeURL);
    let response: any;
    try {
      response = await axios.get(completeURL);
    } catch (error) {
      console.error('The RPC:', rpc, 'Had the following error:', error);
      continue;
    }
    return Math.floor(new Date(response.data.block.header.time).getTime() / 1000);
  }
  throw Error('Unable to query any RPCs');
}

async function refreshLightClient(rpc: ClientRPC, channelId: string): Promise<void> {}

type ChainInfoResponse = {
  client_state: {
    '@type': string; //"/ibc.lightclients.tendermint.v1.ClientState",
    chain_id: string; //"osmosis-1",
    trust_level: {
      numerator: string; //"2",
      denominator: string; //"3"
    };
    trusting_period: string; //"777600s",
    unbonding_period: string; //"1209600s",
    max_clock_drift: string; //"40s",
    frozen_height: {
      revision_number: string; //"0",
      revision_height: string; //"0"
    };
    latest_height: {
      revision_number: string; //"1",
      revision_height: string; //"11876493"
    };
    proof_specs: [
      {
        leaf_spec: {
          hash: string; //"SHA256",
          prehash_key: string; //"NO_HASH",
          prehash_value: string; //"SHA256",
          length: string; //"VAR_PROTO",
          prefix: string; //"AA=="
        };
        inner_spec: {
          child_order: number[]; //[0, 1];
          child_size: number; //33;
          min_prefix_length: number; //4;
          max_prefix_length: number; //12;
          empty_child: null;
          hash: string; //"SHA256"
        };
        max_depth: number; //0;
        min_depth: number; //0;
      },
      {
        leaf_spec: {
          hash: string; //"SHA256",
          prehash_key: string; //"NO_HASH",
          prehash_value: string; //"SHA256",
          length: string; //"VAR_PROTO",
          prefix: string; //"AA=="
        };
        inner_spec: {
          child_order: number[]; //[0, 1];
          child_size: number; //32;
          min_prefix_length: number; //1;
          max_prefix_length: number; //1;
          empty_child: null;
          hash: string; //"SHA256"
        };
        max_depth: number; //0;
        min_depth: number; //0;
      }
    ];
    upgrade_path: string[]; //['upgrade', 'upgradedIBCState'];
    allow_update_after_expiry: boolean; //true;
    allow_update_after_misbehaviour: boolean; //true;
  };
  proof: null;
  proof_height: {
    revision_number: string; //"0",
    revision_height: string; //"5242418"
  };
};
