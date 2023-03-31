import * as dotenv from 'dotenv';
dotenv.config();
import {
  assertEnvironmentVariable,
  chunkArray,
} from '@wormhole-foundation/wormhole-monitor-common';
import { TokenPrice, fetchPriceHistories } from '../src';
import knex from 'knex';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
const TOKEN_PRICE_HISTORY_TABLE = assertEnvironmentVariable('PG_TOKEN_PRICE_HISTORY_TABLE');

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
    // get all of the known coin IDs
    const rows = await pg(TOKEN_METADATA_TABLE)
      .distinct()
      .select('coin_gecko_coin_id')
      .whereNotNull('coin_gecko_coin_id');
    const coinIds = rows.map((row) => row.coin_gecko_coin_id);
    // look up price histories
    const start = new Date('2021-09-13');
    const end = new Date(Date.now());
    const result = await fetchPriceHistories(coinIds, start, end, process.env.COIN_GECKO_API_KEY);
    const tokenPrices: TokenPrice[] = [];
    for (const [date, prices] of Object.entries(result)) {
      for (const [coinId, price] of Object.entries(prices)) {
        tokenPrices.push({
          date,
          coin_gecko_coin_id: coinId,
          price_usd: price,
        });
      }
    }
    // write them to the table
    const chunks = chunkArray(tokenPrices, 1000);
    let insertedCount = 0;
    for (const chunk of chunks) {
      const result: any = await pg(TOKEN_PRICE_HISTORY_TABLE)
        .insert(chunk)
        .onConflict(['date', 'coin_gecko_coin_id'])
        .merge();
      insertedCount += result.rowCount;
    }
    console.log(`Updated ${insertedCount} prices`);
  } catch (e) {
    console.error(e);
  }
  await pg.destroy();
})();
