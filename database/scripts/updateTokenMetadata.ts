import * as dotenv from 'dotenv';
dotenv.config();
import {
  assertEnvironmentVariable,
  chunkArray,
} from '@wormhole-foundation/wormhole-monitor-common';
import {
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_NEAR,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
  CONTRACTS,
  ChainId,
  ChainName,
  assertChain,
  getTypeFromExternalAddress,
  hexToUint8Array,
  isEVMChain,
  queryExternalId,
  queryExternalIdInjective,
  toChainName,
  tryHexToNativeAssetString,
  tryHexToNativeStringNear,
} from '@certusone/wormhole-sdk';
import { CoinGeckoCoin, TokenMetadata, fetchCoins } from '../src';
import knex from 'knex';
import { ChainGrpcWasmApi } from '@injectivelabs/sdk-ts';
import { Network, getNetworkInfo } from '@injectivelabs/networks';
import { LCDClient } from '@xpla/xpla.js';
import { connect } from 'near-api-js';
import { AptosClient } from 'aptos';
import { Connection, JsonRpcProvider } from '@mysten/sui.js';
import { getTokenCoinType } from '@certusone/wormhole-sdk/lib/cjs/sui';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');

const getNativeAddress = async (
  tokenChain: ChainId,
  tokenAddress: string
): Promise<string | null> => {
  try {
    if (
      isEVMChain(tokenChain) ||
      tokenChain === CHAIN_ID_SOLANA ||
      tokenChain === CHAIN_ID_ALGORAND ||
      tokenChain === CHAIN_ID_TERRA
    ) {
      return tryHexToNativeAssetString(tokenAddress, tokenChain);
    } else if (tokenChain === CHAIN_ID_XPLA) {
      const client = new LCDClient({
        URL: 'https://dimension-lcd.xpla.dev',
        chainID: 'dimension_37-1',
      });
      return (
        (await queryExternalId(client, CONTRACTS.MAINNET.xpla.token_bridge, tokenAddress)) || null
      );
    } else if (tokenChain === CHAIN_ID_TERRA2) {
      const client = new LCDClient({
        URL: 'https://phoenix-lcd.terra.dev',
        chainID: 'phoenix-1',
      });
      return (
        (await queryExternalId(client, CONTRACTS.MAINNET.terra2.token_bridge, tokenAddress)) || null
      );
    } else if (tokenChain === CHAIN_ID_INJECTIVE) {
      const client = new ChainGrpcWasmApi(getNetworkInfo(Network.MainnetK8s).grpc);
      return await queryExternalIdInjective(
        client,
        CONTRACTS.MAINNET.injective.token_bridge,
        tokenAddress
      );
    } else if (tokenChain === CHAIN_ID_APTOS) {
      const client = new AptosClient('https://fullnode.mainnet.aptoslabs.com');
      return await getTypeFromExternalAddress(
        client,
        CONTRACTS.MAINNET.aptos.token_bridge,
        tokenAddress
      );
    } else if (tokenChain === CHAIN_ID_NEAR) {
      const NATIVE_NEAR_WH_ADDRESS =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const NATIVE_NEAR_PLACEHOLDER = 'near';
      if (tokenAddress === NATIVE_NEAR_WH_ADDRESS) {
        return NATIVE_NEAR_PLACEHOLDER;
      } else {
        const connection = await connect({
          nodeUrl: 'https://rpc.mainnet.near.org',
          networkId: 'mainnet',
        });
        return await tryHexToNativeStringNear(
          connection.connection.provider,
          CONTRACTS.MAINNET.near.token_bridge,
          tokenAddress
        );
      }
    } else if (tokenChain === CHAIN_ID_SUI) {
      const provider = new JsonRpcProvider(
        new Connection({ fullnode: 'https://fullnode.mainnet.sui.io' })
      );
      return await getTokenCoinType(
        provider,
        CONTRACTS.MAINNET.sui.token_bridge,
        hexToUint8Array(tokenAddress),
        CHAIN_ID_SUI
      );
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

// https://api.coingecko.com/api/v3/asset_platforms
const COINGECKO_PLATFORM_BY_CHAIN: { [key in ChainName]?: string } = {
  solana: 'solana',
  ethereum: 'ethereum',
  terra: 'terra',
  terra2: 'terra-2',
  bsc: 'binance-smart-chain',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  oasis: 'oasis',
  algorand: 'algorand',
  aptos: 'aptos',
  aurora: 'aurora',
  fantom: 'fantom',
  karura: 'karura',
  acala: 'acala',
  klaytn: 'klay-token',
  celo: 'celo',
  near: 'near-protocol',
  moonbeam: 'moonbeam',
  arbitrum: 'arbitrum-one',
  optimism: 'optimistic-ethereum',
  xpla: undefined,
  injective: undefined,
  sui: 'sui',
  base: 'base',
};

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
