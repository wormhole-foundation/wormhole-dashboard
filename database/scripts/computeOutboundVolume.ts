import * as dotenv from 'dotenv';
dotenv.config();
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import knex from 'knex';
import { ChainId, MAX_VAA_DECIMALS } from '@certusone/wormhole-sdk';
import { fetchPrices } from '../src';
import { CHAIN_ID_TO_NAME } from '@certusone/wormhole-sdk';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_TRANSFER_TABLE = assertEnvironmentVariable('PG_TOKEN_TRANSFER_TABLE');
const ATTEST_MESSAGE_TABLE = assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');

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
      sum(t.amount) as amount
    FROM
      ${TOKEN_TRANSFER_TABLE} AS t
      INNER JOIN ${TOKEN_METADATA_TABLE} AS m ON t.token_address = m.token_address
      AND t.token_chain = m.token_chain
    WHERE t.emitter_chain = 1 AND TO_CHAR(TO_TIMESTAMP(t.timestamp), 'YYYY-MM-DD') >= '2023-04-10'
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
  interface Token {
    token_chain: number;
    native_address: string;
    symbol: string;
    name: string;
    notional: number;
  }
  for (const row of rows) {
    const {
      token_chain,
      token_address,
      native_address,
      decimals,
      symbol,
      name,
      coin_gecko_coin_id,
      amount,
    } = row;
    const tokenPrice = prices[coin_gecko_coin_id]?.usd || 0;
    //if (!tokenPrice) {
    //  console.error(
    //    `No price for coin ID: ${coin_gecko_coin_id}, ${token_chain}, ${token_address}, ${amount}`
    //  );
    //  continue;
    //}
    const scaledAmountLocked = Number(amount) / 10 ** Math.min(MAX_VAA_DECIMALS, decimals);
    const notional = scaledAmountLocked * tokenPrice;
    console.log(
      `${
        CHAIN_ID_TO_NAME[token_chain as ChainId]
      }, ${native_address}, ${symbol}, ${name}, ${notional}`
    );
  }

  // console.log(JSON.stringify(rows));
  await pg.destroy();
})();
