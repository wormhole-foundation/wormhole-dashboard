import {
  assertEnvironmentVariable,
  chunkArray,
} from '@wormhole-foundation/wormhole-monitor-common';
import knex, { Knex } from 'knex';
import { ChainId, assertChain, toChainName } from '@certusone/wormhole-sdk';
import {
  COINGECKO_PLATFORM_BY_CHAIN,
  CoinGeckoCoin,
  TokenMetadata,
  fetchCoins,
  getNativeAddress,
} from '@wormhole-foundation/wormhole-monitor-database';
import { isTokenDenylisted } from './consts';

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
    return null;
  }
  for (const coin of coinGeckoCoins) {
    if (coin.platforms[platform] === nativeAddress) {
      coinGeckoCoinIdCache.set(key, coin.id);
      return coin.id;
    }
  }
  return null;
};

export async function updateTokenMetadata(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  let pg: Knex | undefined;
  try {
    pg = knex({
      client: 'pg',
      connection: {
        host: assertEnvironmentVariable('PG_HOST'),
        // port: 5432, // default
        user: assertEnvironmentVariable('PG_USER'),
        password: assertEnvironmentVariable('PG_PASSWORD'),
        database: assertEnvironmentVariable('PG_DATABASE'),
      },
    });
    const table = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
    const result = await pg<TokenMetadata>(table)
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
      if (
        coin_gecko_coin_id === null &&
        native_address !== null &&
        // TODO: this is a hack to avoid updating tokens that are denylisted
        !isTokenDenylisted(token_chain, native_address)
      ) {
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
    if (toUpdate.length > 0) {
      const chunks = chunkArray(toUpdate, 100);
      let numUpdated = 0;
      for (const chunk of chunks) {
        const result: any = await pg<TokenMetadata>(table)
          .insert(chunk)
          .onConflict(['token_chain', 'token_address'])
          .merge(['native_address', 'coin_gecko_coin_id']);
        numUpdated += result.rowCount;
      }
      console.log(`updated ${numUpdated} rows`);
    } else {
      console.log(`nothing to update`);
    }
    res.sendStatus('200');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
  if (pg) {
    await pg.destroy();
  }
}
