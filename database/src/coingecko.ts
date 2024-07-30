import { Chain } from '@wormhole-foundation/sdk-base';
import { chunkArray, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import axios, { isAxiosError } from 'axios';

const COIN_GECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const COIN_GECKO_PRO_API_BASE_URL = 'https://pro-api.coingecko.com/api/v3';
const COIN_GECKO_API_SLEEP_MS = 1000;

// https://api.coingecko.com/api/v3/asset_platforms
export const COINGECKO_PLATFORM_BY_CHAIN: { [key in Chain]?: string } = {
  Solana: 'solana',
  Ethereum: 'ethereum',
  Terra: 'terra',
  Terra2: 'terra-2',
  Bsc: 'binance-smart-chain',
  Polygon: 'polygon-pos',
  Avalanche: 'avalanche',
  Oasis: 'oasis',
  Algorand: 'algorand',
  Aptos: 'aptos',
  Aurora: 'aurora',
  Fantom: 'fantom',
  Karura: 'karura',
  Acala: 'acala',
  Klaytn: 'klay-token',
  Celo: 'celo',
  Near: 'near-protocol',
  Moonbeam: 'moonbeam',
  Arbitrum: 'arbitrum-one',
  Optimism: 'optimistic-ethereum',
  Xpla: undefined,
  Injective: 'injective',
  Sui: 'sui',
  Base: 'base',
  Sei: 'sei-network',
  Scroll: 'scroll',
  Mantle: 'mantle',
  Blast: 'blast',
  Xlayer: 'x-layer',
};

export interface CoinGeckoPrices {
  [coinId: string]: { usd: number | null };
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  platforms: {
    [platform: string]: string;
  };
}

export interface CoinGeckoPriceHistories {
  [date: string]: { [coinId: string]: number };
}

interface CoinGeckoMarketChartResponse {
  prices: [number, number][]; // timestamp ms, price
}

const createConfig = (apiKey: string) => ({
  headers: {
    'x-cg-pro-api-key': apiKey,
  },
});

export const fetchPrices = async (coinIds: string[], apiKey?: string): Promise<CoinGeckoPrices> => {
  const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
  const [baseUrl, config] = apiKey
    ? [COIN_GECKO_PRO_API_BASE_URL, createConfig(apiKey)]
    : [COIN_GECKO_API_BASE_URL, undefined];
  let prices: CoinGeckoPrices = {};
  const chunks = chunkArray(coinIds, 400);
  console.log(`fetching ${chunks.length} chunks of prices`);
  for (const chunk of chunks) {
    console.log(`fetching chunk of ${chunk.length} prices`);
    let currentBackoff = COIN_GECKO_API_SLEEP_MS;
    const url = `${baseUrl}/simple/price?ids=${chunk.join(',')}&vs_currencies=usd`;
    let done: boolean = false;
    while (!done) {
      try {
        const response = await axios.get<CoinGeckoPrices>(url, config);
        console.log(`fetched ${Object.keys(response.data).length} prices`);
        prices = {
          ...prices,
          ...response.data,
        };
        done = true;
      } catch (e) {
        console.error(`failed to fetch prices: ${e}`);
        if (isAxiosError(e) && e.response?.status === 429) {
          if (currentBackoff > FIVE_MINUTES_IN_MS) {
            console.error('Exceeded max backoff time querying CoinGecko API, giving up.');
            throw e;
          }
          console.log(`backing off for ${currentBackoff}ms`);
          await sleep(currentBackoff);
          currentBackoff *= 2;
        } else {
          // Only want to retry on 429s
          throw e;
        }
      }
    }
    await sleep(COIN_GECKO_API_SLEEP_MS);
  }
  return prices;
};

export const fetchCoins = async (apiKey?: string): Promise<CoinGeckoCoin[]> => {
  const [baseUrl, config] = apiKey
    ? [COIN_GECKO_PRO_API_BASE_URL, createConfig(apiKey)]
    : [COIN_GECKO_API_BASE_URL, undefined];
  return (await axios.get<CoinGeckoCoin[]>(`${baseUrl}/coins/list?include_platform=true`, config))
    .data;
};

const toTimestamp = (date: Date): number => parseInt((date.getTime() / 1000).toFixed(0));

export const fetchPriceHistories = async (
  coinIds: string[],
  start: Date,
  end: Date,
  apiKey?: string
): Promise<CoinGeckoPriceHistories> => {
  const [baseUrl, config] = apiKey
    ? [COIN_GECKO_PRO_API_BASE_URL, createConfig(apiKey)]
    : [COIN_GECKO_API_BASE_URL, undefined];
  const priceHistories: CoinGeckoPriceHistories = {};
  const from = toTimestamp(start);
  const to = toTimestamp(end);
  for (const coinId of coinIds) {
    try {
      const url = `${baseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
      const response = await axios.get<CoinGeckoMarketChartResponse>(url, config);
      for (const [date, price] of response.data.prices) {
        const dateString = new Date(date).toISOString().slice(0, 10);
        priceHistories[dateString] = {
          ...priceHistories[dateString],
          [coinId]: price,
        };
      }
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) {
        console.error(`coin not found: ${coinId}`);
      } else {
        console.error(e);
      }
    }
    await sleep(COIN_GECKO_API_SLEEP_MS);
  }
  return priceHistories;
};
