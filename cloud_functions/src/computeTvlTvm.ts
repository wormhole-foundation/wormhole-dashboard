import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import knex from 'knex';
import { TokenPrice } from '@wormhole-foundation/wormhole-monitor-database';
import { Firestore } from 'firebase-admin/firestore';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  AccountEntry,
  assertEnvironmentVariable,
  TokenMetaDatum,
} from '@wormhole-foundation/wormhole-monitor-common';

const WORMCHAIN_URLS: string[] = [
  'https://gateway.mainnet.xlabs.xyz',
  'https://tncnt-eu-wormchain-main-01.rpc.p2p.world',
  'https://wormchain-rpc.quickapi.com',
];

const PAGE_LIMIT: number = 2000; // throws a gas limit error over this

type FullMetadata = {
  metadata: TokenMetaDatum;
  decimalDivisor: number;
};

type Key = {
  chain_id: number;
  token_chain: number;
  token_address: string;
};

const metadataMap: Map<string, FullMetadata> = new Map<string, FullMetadata>();
const priceMap: Map<string, TokenPrice> = new Map<string, TokenPrice>(); // key is gecko_id
const accountMap: Map<Key, AccountEntry> = new Map<Key, AccountEntry>();

async function getAccountantAccounts(): Promise<AccountEntry[]> {
  for (const url of WORMCHAIN_URLS) {
    try {
      const cosmWasmClient: CosmWasmClient = await CosmWasmClient.connect(url);
      let accounts: AccountEntry[] = [];
      let response: any;
      let start_after: Key | undefined = undefined;
      do {
        response = await cosmWasmClient.queryContractSmart(ACCOUNTANT_CONTRACT_ADDRESS, {
          all_accounts: {
            limit: PAGE_LIMIT,
            start_after,
          },
        });
        accounts = [...accounts, ...response.accounts];
        if (response.accounts.length > 0) {
          start_after = response.accounts[response.accounts.length - 1].key;
        }
      } while (response.accounts.length === PAGE_LIMIT);
      if (accounts.length > 0) {
        return accounts;
      }
    } catch (e) {
      console.error(`Error getting accountant accounts from ${url}: ${e}`);
      continue;
    }
  }
  throw new Error('Unable to get accountant accounts from provisioned URLs.');
}

async function getTokenMetadata(): Promise<TokenMetaDatum[]> {
  try {
    const pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_USER'),
        password: assertEnvironmentVariable('PG_PASSWORD'),
        database: assertEnvironmentVariable('PG_DATABASE'),
        host: assertEnvironmentVariable('PG_HOST'),
      },
    });
    // get all of the known coin IDs
    const rows = await pg(assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE'))
      .select('*')
      .whereNotNull('coin_gecko_coin_id')
      .distinct();
    return rows;
  } catch (e) {
    console.error(`Error getting token metadata: ${e}`);
    throw e;
  }
}

async function getTokenPrices(): Promise<TokenPrice[]> {
  try {
    const pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_USER'),
        password: assertEnvironmentVariable('PG_PASSWORD'),
        database: assertEnvironmentVariable('PG_DATABASE'),
        host: assertEnvironmentVariable('PG_HOST'),
      },
    });
    // get all of the known coin IDs
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const rows = await pg(assertEnvironmentVariable('PG_TOKEN_PRICE_HISTORY_TABLE'))
      .select('*')
      .whereNotNull('coin_gecko_coin_id')
      .andWhere('date', '=', today)
      .distinct();
    return rows;
  } catch (e) {
    console.error(`Error getting token prices: ${e}`);
    throw e;
  }
}

async function populateMaps() {
  // Populate the metadata map.
  const metaData: TokenMetaDatum[] = await getTokenMetadata();
  console.log(`Got ${metaData.length} token metadata entries`);
  for (const md of metaData) {
    const key = `${md.token_chain}/${md.token_address}`;
    // wormhole supports a maximum of 8 decimals
    if (md.decimals > 8) {
      md.decimals = 8;
    }
    let decimalsFloat = Math.pow(10.0, md.decimals);
    let decimals = Math.floor(decimalsFloat);
    metadataMap.set(key, {
      metadata: md,
      decimalDivisor: decimals,
    });
  }

  // Next get the account information from the accountant
  const accounts: AccountEntry[] = await getAccountantAccounts();
  console.log(`Got ${accounts.length} accountant accounts`);
  for (const a of accounts) {
    accountMap.set(a.key, a);
  }

  // Lastly, get the price information
  const prices: TokenPrice[] = await getTokenPrices();
  console.log(`Got ${prices.length} token prices`);
  for (const p of prices) {
    // Check the date on the price.  Only use the latest.
    const existingPrice = priceMap.get(p.coin_gecko_coin_id);
    if (existingPrice) {
      if (p.date < existingPrice.date) {
        continue;
      }
    }
    priceMap.set(p.coin_gecko_coin_id, p);
  }
}

export async function computeTvlTvm(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  await populateMaps();
  let tvmByChain = new Map<number, number>();
  let tvlByChain = new Map<number, number>();

  for (let [key, value] of accountMap) {
    if (value.balance === '0') {
      continue;
    }
    if (!tvmByChain.has(value.key.chain_id)) {
      tvmByChain.set(value.key.chain_id, 0);
    }
    if (!tvlByChain.has(value.key.chain_id)) {
      tvlByChain.set(value.key.chain_id, 0);
    }
    const mapKey = `${value.key.token_chain}/${value.key.token_address}`;
    const metadata = metadataMap.get(mapKey);
    if (!metadata) {
      continue;
    }
    const priceInfo = priceMap.get(metadata.metadata.coin_gecko_coin_id);
    if (!priceInfo) {
      continue;
    }

    let acctBalance = Number(value.balance);
    if (metadata.decimalDivisor === 0) {
      console.error(`Decimal divisor is 0 for ${metadata.metadata.name}`);
      continue;
    }
    acctBalance = acctBalance / metadata.decimalDivisor;

    if (priceInfo.price_usd === 0) {
      continue;
    }
    let notional = acctBalance * priceInfo.price_usd;

    if (value.key.chain_id === value.key.token_chain) {
      // TVL
      tvlByChain.set(value.key.chain_id, tvlByChain.get(value.key.chain_id)! + notional);
    } else {
      // TVM
      tvmByChain.set(value.key.chain_id, tvmByChain.get(value.key.chain_id)! + notional);
    }
  }
  await storeLatestTvlTvm(tvlByChain, tvmByChain);
  res.status(200).send('successfully computed TVL and TVM');
  return;
}

async function storeLatestTvlTvm(
  tvl: Map<number, number>,
  tvm: Map<number, number>
): Promise<void> {
  const firestore = new Firestore();
  type LatestTvlTvm = {
    tvl: number;
    tvm: number;
  };
  let latestValuesByChain: Map<number, LatestTvlTvm> = new Map<number, LatestTvlTvm>();

  // Initialize the totals object
  latestValuesByChain.set(0, { tvl: 0, tvm: 0 });
  tvl.forEach((value, key) => {
    let latestTotal = latestValuesByChain.get(0);
    if (latestTotal) {
      latestTotal.tvl += value;
    }
    if (!latestValuesByChain.has(key)) {
      latestValuesByChain.set(key, { tvl: 0, tvm: 0 });
    }
    let latest = latestValuesByChain.get(key);
    if (latest) {
      latest.tvl = value;
    }
    console.log(`TVl: chainId: ${key} = ${value}`);
  });
  tvm.forEach((value, key) => {
    let latestTotal = latestValuesByChain.get(0);
    if (latestTotal) {
      latestTotal.tvm += value;
    }
    if (!latestValuesByChain.has(key)) {
      console.error(`TVM: chainId: ${key} not found in latestValuesByChain`);
      latestValuesByChain.set(key, { tvl: 0, tvm: 0 });
    }
    let latest = latestValuesByChain.get(key);
    if (latest) {
      latest.tvm = value;
    }
    console.log(`TVM: chainId: ${key} = ${value}`);
  });

  let tots = latestValuesByChain.get(0);
  if (tots) {
    console.log(`Total TVL: ${tots.tvl}`);
    console.log(`Total TVM: ${tots.tvm}`);
  }

  const latestCollectionName = assertEnvironmentVariable('FIRESTORE_LATEST_TVLTVM_COLLECTION');
  latestValuesByChain.forEach(async (value, key) => {
    const collection = firestore.collection(latestCollectionName);
    const doc = collection.doc(key.toString());
    await doc.set(value);
  });
}
