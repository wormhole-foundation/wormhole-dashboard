import { chunkArray, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import axios, { AxiosError, isAxiosError } from 'axios';

const COIN_GECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const COIN_GECKO_PRO_API_BASE_URL = 'https://pro-api.coingecko.com/api/v3';
const COIN_GECKO_API_SLEEP_MS = 200;

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
  const [baseUrl, config] = apiKey
    ? [COIN_GECKO_PRO_API_BASE_URL, createConfig(apiKey)]
    : [COIN_GECKO_API_BASE_URL, undefined];
  let prices: CoinGeckoPrices = {};
  const chunks = chunkArray(coinIds, 200);
  for (const chunk of chunks) {
    const url = `${baseUrl}/simple/price?ids=${chunk.join(',')}&vs_currencies=usd`;
    const response = await axios.get<CoinGeckoPrices>(url, config);
    prices = {
      ...prices,
      ...response.data,
    };
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
