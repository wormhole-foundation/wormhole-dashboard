import * as dotenv from 'dotenv';
dotenv.config();
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import knex from 'knex';
import { MAX_VAA_DECIMALS } from '@certusone/wormhole-sdk';
import { fetchPrices } from '../src';
import { Firestore } from 'firebase-admin/firestore';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_TRANSFER_TABLE = assertEnvironmentVariable('PG_TOKEN_TRANSFER_TABLE');
const ATTEST_MESSAGE_TABLE = assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
const FIRESTORE_TVL_COLLECTION = assertEnvironmentVariable('FIRESTORE_TVL_COLLECTION');

interface LockedAsset {
  Address: string;
  Amount: number;
  CoinGeckoId: string;
  Name: string;
  Notional: number;
  Symbol: string;
  TokenDecimals: number;
  TokenPrice: number;
}

interface LockedAssets {
  [tokenAddress: string]: LockedAsset;
}

type ChainsAssets = {
  [chain: string]: LockedAssets;
};

interface NotionalTVL {
  Last24HoursChange: ChainsAssets;
  AllTime: ChainsAssets;
}

// TODO: filter out tokens w/ 0 quantity?
// TODO: include tokens in response without coin gecko data?
// Note: both of these may be useful for the governor
// might be better to write a new script that generates the governor token list

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
  // TODO: don't use a raw query
  const result = await pg.raw(
    `
      SELECT
      t.token_address,
      t.token_chain,
      m.coin_gecko_coin_id,
      m.native_address,
      m.name,
      m.symbol,
      m.decimals,
      SUM(
        CASE
          WHEN t.emitter_chain = t.token_chain THEN amount
          ELSE - amount
        END
      ) AS amount_locked
    FROM
      ${assertEnvironmentVariable('PG_TOKEN_TRANSFER_TABLE')} AS t
      INNER JOIN ${assertEnvironmentVariable(
        'PG_TOKEN_METADATA_TABLE'
      )} AS m ON t.token_address = m.token_address
      AND t.token_chain = m.token_chain
    WHERE
      m.coin_gecko_coin_id IS NOT NULL
      AND m.native_address IS NOT NULL
      AND (
        t.emitter_chain = t.token_chain
        OR t.to_chain = t.token_chain
      )
    GROUP BY
      t.token_address,
      t.token_chain,
      m.coin_gecko_coin_id,
      m.native_address,
      m.name,
      m.symbol,
      m.decimals
    `
  );

  const { rows } = result;
  const coinIds = rows.map((row: any) => row.coin_gecko_coin_id);
  const prices = await fetchPrices(coinIds);
  const notionalTvl: NotionalTVL = {
    Last24HoursChange: {},
    AllTime: {},
  };
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
  for (const row of rows) {
    const {
      token_chain,
      native_address,
      decimals,
      symbol,
      name,
      coin_gecko_coin_id,
      amount_locked,
    } = row;
    const tokenPrice = prices[coin_gecko_coin_id].usd;
    if (!tokenPrice) {
      console.error(`No price for coin ID: ${coin_gecko_coin_id}`);
      continue;
    }
    const scaledAmountLocked = Number(amount_locked) / 10 ** Math.min(MAX_VAA_DECIMALS, decimals);
    const notional = scaledAmountLocked * tokenPrice;
    notionalTvl.AllTime['*']['*'].Notional += notional;
    if (notionalTvl.AllTime[token_chain] === undefined) {
      notionalTvl.AllTime[token_chain] = {
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
    notionalTvl.AllTime[token_chain]['*'].Notional += notional;
    notionalTvl.AllTime[token_chain][native_address] = {
      Address: native_address,
      Amount: scaledAmountLocked,
      CoinGeckoId: coin_gecko_coin_id,
      Name: name,
      Notional: notional,
      Symbol: symbol,
      TokenDecimals: decimals,
      TokenPrice: tokenPrice,
    };
  }
  console.log(JSON.stringify(notionalTvl));
  await pg.destroy();
})();
