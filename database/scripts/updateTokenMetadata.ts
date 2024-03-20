import * as dotenv from 'dotenv';
dotenv.config();
import {
  assertEnvironmentVariable,
  chunkArray,
} from '@wormhole-foundation/wormhole-monitor-common';
import { ChainId, assertChain, toChainName } from '@certusone/wormhole-sdk';
import {
  COINGECKO_PLATFORM_BY_CHAIN,
  CoinGeckoCoin,
  TokenMetadata,
  fetchCoins,
  getNativeAddress,
} from '../src';
import knex from 'knex';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');

const coinGeckoCoinIdCache = new Map<string, string>();

const findCoinGeckoCoinId = (
  chainId: ChainId,
  nativeAddress: string,
  coinGeckoCoins: CoinGeckoCoin[]
): string | null => {
  const key = `${chainId}/${nativeAddress}`;
  const coinId = coinGeckoCoinIdCache.get(key);
  if (coinId !== undefined) {
    return coinId;
  }
  const chainName = toChainName(chainId);
  const platform = COINGECKO_PLATFORM_BY_CHAIN[chainName];
  if (platform === undefined) {
    // throw new Error(`No coin gecko platform found for chain: ${chainName}`);
    // console.error(`No coin gecko platform found for chain: ${chainName}`);
    return null;
  }
  for (const coin of coinGeckoCoins) {
    if (coin.platforms[platform] === nativeAddress) {
      coinGeckoCoinIdCache.set(key, coin.id);
      return coin.id;
    }
  }
  // throw new Error(`No coin gecko coin ID found for chain: ${chainName}, address: ${nativeAddress}`);
  // console.error(`No coin gecko coin ID found for chain: ${chainName}, address: ${nativeAddress}`);
  return null;
};

// This script tries to populate token metadata missing certain fields
// Note: Run the Cloud SQL Auth proxy before running this script
// https://cloud.google.com/sql/docs/postgres/connect-instance-auth-proxy

(async () => {
  const pg = knex({
    client: 'pg',
    connection: {
      host: PG_HOST,
      // port: 5432, // default
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
    },
  });
  try {
    const result = await pg<TokenMetadata>(TOKEN_METADATA_TABLE)
      .select()
      .whereNull('native_address')
      .orWhereNull('coin_gecko_coin_id');
    const coinGeckoCoins = await fetchCoins();
    const toUpdate: TokenMetadata[] = [];
    for (let {
      token_chain,
      token_address,
      native_address,
      coin_gecko_coin_id,
      name,
      symbol,
      decimals,
    } of result) {
      assertChain(token_chain);
      let shouldUpdate = false;
      if (native_address === null) {
        native_address = await getNativeAddress(token_chain, token_address);
        shouldUpdate ||= native_address !== null;
      }
      if (coin_gecko_coin_id === null && native_address !== null) {
        coin_gecko_coin_id = findCoinGeckoCoinId(token_chain, native_address, coinGeckoCoins);
        shouldUpdate ||= coin_gecko_coin_id !== null;
      }
      if (shouldUpdate) {
        const tokenMetadata: TokenMetadata = {
          token_chain,
          token_address,
          native_address: native_address?.replace('\x00', '') || null, // postgres complains about invalid utf8 byte sequence
          coin_gecko_coin_id,
          name,
          symbol,
          decimals,
        };
        toUpdate.push(tokenMetadata);
        console.log('will update', tokenMetadata);
      }
    }
    const chunks = chunkArray(toUpdate, 100);
    let numUpdated = 0;
    for (const chunk of chunks) {
      const result: any = await pg<TokenMetadata>(TOKEN_METADATA_TABLE)
        .insert(chunk)
        .onConflict(['token_chain', 'token_address'])
        .merge(['native_address', 'coin_gecko_coin_id']);
      numUpdated += result.rowCount;
    }
    console.log(`updated ${numUpdated} rows`);
  } catch (e) {
    console.error(e);
  }
  await pg.destroy();
})();