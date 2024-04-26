import { ChainId } from '@wormhole-foundation/sdk-base';

export type ObservedEventInfo = {
  info: {
    timestamp: {
      value: string;
      timestamp: string;
    }[];
    txHash: {
      value: string;
      timestamp: string;
    }[];
    hasSignedVaa: {
      value: string;
      timestamp: string;
    }[];
  };
};

export type ObservedEvent = {
  id: string;
  data: ObservedEventInfo;
};

export type ObservedMessage = {
  id: string;
  chain: number;
  block: number;
  emitter: string;
  seq: string;
  timestamp: any;
  txHash: any;
  hasSignedVaa: any;
};

export type ObservedMessageResponse = {
  messages: ObservedMessage[];
  lastUpdated: number;
  lastRowKey: string;
};

export type MessagesByChain = {
  [chain in ChainId]: ObservedMessageResponse;
};

export function makeCache() {
  const cache: MessagesByChain = {
    1: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    2: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    3: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    5: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    6: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    7: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    8: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    9: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    11: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    12: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    13: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    14: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    15: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    16: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    17: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    18: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    19: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    20: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    21: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    22: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    23: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    24: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    25: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    26: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    28: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    29: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    30: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    32: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    33: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    34: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    35: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    36: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    37: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    38: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    39: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    40: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    3104: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4000: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4001: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4002: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4003: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4004: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4005: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4006: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4007: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4008: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10002: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10003: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10004: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10005: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10006: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10007: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
  };
  return cache;
}

export interface LockedAsset {
  Address: string;
  Amount: number;
  CoinGeckoId: string;
  Name: string;
  Notional: number;
  Symbol: string;
  TokenDecimals: number;
  TokenPrice: number;
}

export interface LockedAssets {
  [tokenAddress: string]: LockedAsset;
}

export interface ChainsAssets {
  [chain: string]: LockedAssets;
}

export interface NotionalTVL {
  Last24HoursChange: ChainsAssets;
  AllTime: ChainsAssets;
}

export interface NotionalByDate {
  [date: string]: { [chainId: string]: { [address: string]: { Notional: number } } };
}

export interface TVLHistory {
  DailyLocked: NotionalByDate;
}

export interface MessageCountsHistory {
  DailyTotals: {
    [date: string]: { [chainId: string]: number };
  };
}

export type TokenEntry = {
  price: number;
  decimalDivisor: number;
  symbol: string;
  coinGeckoId: string;
};

export type AccountEntry = {
  key: {
    chain_id: number;
    token_chain: number;
    token_address: string;
  };
  balance: string;
};

export type ReobserveInfo = {
  chain: number;
  txhash: string;
  vaaKey: string;
};

export type TokenMetaDatum = {
  token_chain: number; //5;
  token_address: string; //'000000000000000000000000df7837de1f2fa4631d716cf2502f8b230f1dcc32';
  native_address: string; //'0xdf7837de1f2fa4631d716cf2502f8b230f1dcc32';
  coin_gecko_coin_id: string; //'telcoin';
  decimals: number; //2;
  symbol: string; //'TEL';
  name: string; //'Telcoin (PoS)';
};

export type PagerDutyInfo = {
  url: string;
  routingKey: string;
  summary: string;
  source: string;
};

export type SlackInfo = {
  channelId: string;
  postUrl: string;
  botToken: string;
  msg: string;
  bannerTxt: string;
};

export interface EventData {
  blockNumber: number;
  txHash: string;
  from: string;
  to: string;
  token: string;
  amount: string;
  isDeposit: boolean;
}
