import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  AccountEntry,
  MAX_VAA_DECIMALS,
  NotionalTVL,
  assertEnvironmentVariable,
  isTokenDenylisted,
} from '@wormhole-foundation/wormhole-monitor-common';
import {
  COINGECKO_PLATFORM_BY_CHAIN,
  CoinGeckoCoin,
  fetchCoinDetail,
  fetchCoins,
  fetchPrices,
  getNativeAddress,
} from '@wormhole-foundation/wormhole-monitor-database';
import { ChainId, chainIdToChain } from '@wormhole-foundation/sdk-base';
import { Firestore } from 'firebase-admin/firestore';

const WORMCHAIN_URLS: string[] = [
  'https://wormchain.mainnet.xlabs.xyz',
  'https://tncnt-eu-wormchain-main-01.rpc.p2p.world',
  'https://wormchain-rpc.quickapi.com',
];

const PAGE_LIMIT = 2000; // accountant throws a gas limit error above this

// Re-attempt resolution for tokens we couldn't map to CoinGecko after 30 days,
// in case they've been listed since.
const UNRESOLVED_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

// Leave headroom inside the cloud function's timeout so we can still write a
// NotionalTVL doc even if we couldn't resolve every new token this run.
const RESOLVE_DEADLINE_MS = 7 * 60 * 1000;

type CachedMetadata = {
  token_chain: number;
  token_address: string;
  native_address: string | null;
  coin_gecko_coin_id: string | null;
  decimals: number | null;
  symbol: string | null;
  name: string | null;
  resolved: boolean;
  updatedAt: number;
};

type LatestTokenDataEntry = {
  token_chain: number;
  token_address: string;
  native_address: string;
  coin_gecko_coin_id: string;
  decimals: number;
  symbol: string;
  name: string;
  price_usd: number;
};

type LatestTokenData = {
  data: LatestTokenDataEntry[];
  updatedAt: number;
};

function cacheKey(token_chain: number, token_address: string): string {
  return `${token_chain}_${token_address}`;
}

async function getAccountantAccounts(): Promise<AccountEntry[]> {
  for (const url of WORMCHAIN_URLS) {
    try {
      const client = await CosmWasmClient.connect(url);
      const accounts: AccountEntry[] = [];
      let response: any;
      let start_after: AccountEntry['key'] | undefined = undefined;
      do {
        response = await client.queryContractSmart(ACCOUNTANT_CONTRACT_ADDRESS, {
          all_accounts: { limit: PAGE_LIMIT, start_after },
        });
        accounts.push(...response.accounts);
        if (response.accounts.length > 0) {
          start_after = response.accounts[response.accounts.length - 1].key;
        }
      } while (response.accounts.length === PAGE_LIMIT);
      if (accounts.length > 0) return accounts;
    } catch (e) {
      console.error(`Error getting accountant accounts from ${url}: ${e}`);
    }
  }
  throw new Error('Unable to get accountant accounts from provisioned URLs.');
}

async function loadMetadataCache(
  firestore: Firestore,
  collectionName: string
): Promise<Map<string, CachedMetadata>> {
  const snap = await firestore.collection(collectionName).get();
  const cache = new Map<string, CachedMetadata>();
  for (const doc of snap.docs) {
    cache.set(doc.id, doc.data() as CachedMetadata);
  }
  return cache;
}

async function writeMetadata(
  firestore: Firestore,
  collectionName: string,
  entry: CachedMetadata
): Promise<void> {
  await firestore
    .collection(collectionName)
    .doc(cacheKey(entry.token_chain, entry.token_address))
    .set(entry);
}

function indexCoinsByPlatform(coins: CoinGeckoCoin[]): Map<string, Map<string, CoinGeckoCoin>> {
  const byPlatform = new Map<string, Map<string, CoinGeckoCoin>>();
  for (const coin of coins) {
    for (const [platform, address] of Object.entries(coin.platforms || {})) {
      if (!address) continue;
      let bucket = byPlatform.get(platform);
      if (!bucket) {
        bucket = new Map();
        byPlatform.set(platform, bucket);
      }
      bucket.set(address.toLowerCase(), coin);
    }
  }
  return byPlatform;
}

async function resolveMetadata(
  token_chain: number,
  token_address: string,
  coinsByPlatform: Map<string, Map<string, CoinGeckoCoin>>,
  apiKey?: string
): Promise<CachedMetadata> {
  const base: CachedMetadata = {
    token_chain,
    token_address,
    native_address: null,
    coin_gecko_coin_id: null,
    decimals: null,
    symbol: null,
    name: null,
    resolved: false,
    updatedAt: Date.now(),
  };
  let chainName;
  try {
    chainName = chainIdToChain(token_chain as ChainId);
  } catch {
    return base;
  }
  const platform = COINGECKO_PLATFORM_BY_CHAIN[chainName];
  if (!platform) return base;
  let native: string | null = null;
  try {
    native = await getNativeAddress(token_chain as ChainId, token_address);
  } catch (e) {
    console.error(`getNativeAddress failed for ${token_chain}/${token_address}:`, e);
    return base;
  }
  if (!native) return base;
  base.native_address = native;
  const coin = coinsByPlatform.get(platform)?.get(native.toLowerCase());
  if (!coin) return base;
  base.coin_gecko_coin_id = coin.id;
  base.symbol = coin.symbol;
  base.name = coin.name;
  const detail = await fetchCoinDetail(coin.id, apiKey);
  const decimals = detail?.detail_platforms?.[platform]?.decimal_place ?? null;
  if (decimals === null) return base;
  return {
    ...base,
    decimals,
    symbol: detail?.symbol || coin.symbol,
    name: detail?.name || coin.name,
    resolved: true,
  };
}

function shouldRetry(cached: CachedMetadata | undefined): boolean {
  if (!cached) return true;
  if (cached.resolved) return false;
  return Date.now() - cached.updatedAt >= UNRESOLVED_RETRY_MS;
}

export async function computeTVL(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  try {
    const tvlCollection = assertEnvironmentVariable('FIRESTORE_TVL_COLLECTION');
    const metadataCollection = assertEnvironmentVariable('FIRESTORE_TVL_METADATA_COLLECTION');
    const latestTokenDataCollection = assertEnvironmentVariable(
      'FIRESTORE_LATEST_TOKEN_DATA_COLLECTION'
    );
    const apiKey = process.env.COINGECKO_API_KEY;
    const firestore = new Firestore();

    const accounts = await getAccountantAccounts();
    console.log(`Got ${accounts.length} accountant accounts`);

    const cache = await loadMetadataCache(firestore, metadataCollection);
    console.log(`Loaded ${cache.size} cached metadata entries`);

    // Only home-chain balances (chain_id === token_chain) contribute to TVL, so
    // we only ever need metadata for those (token_chain, token_address) pairs.
    // Wrapped-only entries are discarded here rather than later, to keep the
    // metadata cache focused on tokens that can actually show up in the output.
    const homeChainAccounts = accounts.filter((a) => a.key.chain_id === a.key.token_chain);
    const uniqueTokens = new Map<string, { token_chain: number; token_address: string }>();
    for (const account of homeChainAccounts) {
      const key = cacheKey(account.key.token_chain, account.key.token_address);
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, {
          token_chain: account.key.token_chain,
          token_address: account.key.token_address,
        });
      }
    }
    const toResolve = Array.from(uniqueTokens.entries()).filter(([k]) => shouldRetry(cache.get(k)));
    console.log(`Need to resolve ${toResolve.length} tokens`);

    let coinsByPlatform: Map<string, Map<string, CoinGeckoCoin>> | undefined;
    if (toResolve.length > 0) {
      const coins = await fetchCoins(apiKey);
      console.log(`Fetched ${coins.length} CoinGecko coins`);
      coinsByPlatform = indexCoinsByPlatform(coins);
    }

    const deadline = Date.now() + RESOLVE_DEADLINE_MS;
    let resolvedCount = 0;
    let skippedCount = 0;
    for (const [key, { token_chain, token_address }] of toResolve) {
      if (Date.now() > deadline) {
        skippedCount = toResolve.length - resolvedCount - skippedCount;
        console.warn(`Resolve deadline reached; ${skippedCount} tokens deferred to next run`);
        break;
      }
      const entry = await resolveMetadata(token_chain, token_address, coinsByPlatform!, apiKey);
      cache.set(key, entry);
      try {
        await writeMetadata(firestore, metadataCollection, entry);
      } catch (e) {
        console.error(`Failed to cache metadata for ${key}:`, e);
      }
      resolvedCount++;
    }
    console.log(`Resolved ${resolvedCount} new tokens this run`);

    // Collect coin IDs that actually appear in the accountant, then fetch live prices.
    const coinIds = Array.from(
      new Set(
        Array.from(uniqueTokens.keys()).flatMap((key) => {
          const m = cache.get(key);
          return m?.coin_gecko_coin_id ? [m.coin_gecko_coin_id] : [];
        })
      )
    );
    const prices = await fetchPrices(coinIds, apiKey);

    const notionalTvl: NotionalTVL = { Last24HoursChange: {}, AllTime: {} };
    notionalTvl.AllTime['*'] = {
      '*': {
        Address: '',
        Amount: 0,
        CoinGeckoId: '',
        Name: 'all',
        Notional: 0,
        Symbol: '*',
        TokenDecimals: 0,
        TokenPrice: 0,
      },
    };
    for (const account of homeChainAccounts) {
      if (account.balance === '0') continue;
      const m = cache.get(cacheKey(account.key.token_chain, account.key.token_address));
      if (!m || !m.resolved || !m.coin_gecko_coin_id || !m.native_address || m.decimals === null) {
        continue;
      }
      if (isTokenDenylisted(m.token_chain as ChainId, m.native_address)) continue;
      const tokenPrice = prices[m.coin_gecko_coin_id]?.usd;
      if (!tokenPrice) continue;
      const scaledAmountLocked =
        Number(account.balance) / 10 ** Math.min(MAX_VAA_DECIMALS, m.decimals);
      const notional = scaledAmountLocked * tokenPrice;
      notionalTvl.AllTime['*']['*'].Notional += notional;
      if (notionalTvl.AllTime[m.token_chain] === undefined) {
        notionalTvl.AllTime[m.token_chain] = {
          '*': {
            Address: '*',
            Amount: 0,
            CoinGeckoId: '',
            Name: '',
            Notional: 0,
            Symbol: 'all',
            TokenDecimals: 0,
            TokenPrice: 0,
          },
        };
      }
      notionalTvl.AllTime[m.token_chain]['*'].Notional += notional;
      notionalTvl.AllTime[m.token_chain][m.native_address] = {
        Address: m.native_address,
        Amount: scaledAmountLocked,
        CoinGeckoId: m.coin_gecko_coin_id,
        Name: m.name || '',
        Notional: notional,
        Symbol: m.symbol || '',
        TokenDecimals: m.decimals,
        TokenPrice: tokenPrice,
      };
    }
    await firestore.collection(tvlCollection).doc('tvl').set(notionalTvl);
    console.log(`Computed TVL: $${notionalTvl.AllTime['*']['*'].Notional.toFixed(2)}`);

    // Also emit a denormalized token data doc that /latest-tokendata serves.
    const latestTokenData: LatestTokenData = {
      updatedAt: Date.now(),
      data: Array.from(uniqueTokens.keys()).flatMap<LatestTokenDataEntry>((key) => {
        const m = cache.get(key);
        if (
          !m ||
          !m.resolved ||
          !m.coin_gecko_coin_id ||
          !m.native_address ||
          m.decimals === null ||
          m.symbol === null ||
          m.name === null
        ) {
          return [];
        }
        const price_usd = prices[m.coin_gecko_coin_id]?.usd;
        if (!price_usd) return [];
        return [
          {
            token_chain: m.token_chain,
            token_address: m.token_address,
            native_address: m.native_address,
            coin_gecko_coin_id: m.coin_gecko_coin_id,
            decimals: m.decimals,
            symbol: m.symbol,
            name: m.name,
            price_usd,
          },
        ];
      }),
    };
    await firestore.collection(latestTokenDataCollection).doc('latest').set(latestTokenData);
    console.log(`Wrote ${latestTokenData.data.length} token data entries`);

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
