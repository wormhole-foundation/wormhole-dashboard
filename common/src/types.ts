import { ChainId, chainIds } from '@wormhole-foundation/sdk-base';

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
  [chain in ChainId]?: ObservedMessageResponse;
};

export function makeCacheEntry(): ObservedMessageResponse {
  return {
    messages: [],
    lastUpdated: 0,
    lastRowKey: '',
  };
}

export function makeCache(): MessagesByChain {
  const cache: MessagesByChain = {};

  chainIds.forEach((chainId) => {
    cache[chainId] = makeCacheEntry();
  });

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
  timestamp?: number;
}

export type TokenAmount = {
  amount: string;
  decimals: number;
};

export function normalizeToDecimals(tokenAmount: TokenAmount, targetDecimals: number): bigint {
  const { amount, decimals } = tokenAmount;
  const bigIntAmount = BigInt(amount);
  let normalizedAmount: bigint;

  if (decimals < targetDecimals) {
    // If less decimals, multiply to shift the decimal point to the right
    const factor = BigInt(10 ** (targetDecimals - decimals));
    normalizedAmount = bigIntAmount * factor;
  } else if (decimals > targetDecimals) {
    // If more decimals, divide to shift the decimal point to the left
    const factor = BigInt(10 ** (decimals - targetDecimals));
    normalizedAmount = bigIntAmount / factor;
  } else {
    normalizedAmount = bigIntAmount;
  }

  return normalizedAmount;
}

export type NTTTotalSupplyAndLockedData = {
  tokenName: string;
  chain: ChainId;
  // this is bigint but for the sake of precision we are using string
  amountLocked?: TokenAmount;
  totalSupply?: TokenAmount;
  evmTotalSupply?: NTTTotalSupplyAndLockedData[];
};

export type NTTRateLimit = {
  tokenName: string;
  srcChain?: ChainId;
  destChain?: ChainId;
  amount?: TokenAmount;
  totalInboundCapacity?: TokenAmount;
  inboundCapacity?: NTTRateLimit[];
};
