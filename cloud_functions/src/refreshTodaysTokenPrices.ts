import {
  assertEnvironmentVariable,
  chunkArray,
} from '@wormhole-foundation/wormhole-monitor-common';
import {
  TokenPrice,
  fetchPrices,
} from '@wormhole-foundation/wormhole-monitor-database';
import knex from 'knex';

// This function looks up today's prices for tokens
// and writes them to the `TOKEN_PRICE_HISTORY` table
export async function refreshTodaysTokenPrices(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
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
      .select('coin_gecko_coin_id')
      .whereNotNull('coin_gecko_coin_id')
      .distinct();
    const coinIds = rows.map((row) => row.coin_gecko_coin_id);
    // look up today's prices
    const prices = await fetchPrices(coinIds);
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const tokenPrices = Object.entries(prices).reduce<TokenPrice[]>(
      (arr, [coinId, price]) => {
        if (price.usd) {
          arr.push({
            date: today,
            coin_gecko_coin_id: coinId,
            price_usd: price.usd,
          });
        }
        return arr;
      },
      []
    );
    // write them to the table
    const chunks = chunkArray(tokenPrices, 1000);
    let insertedCount = 0;
    for (const chunk of chunks) {
      const result: any = await pg(
        assertEnvironmentVariable('PG_TOKEN_PRICE_HISTORY_TABLE')
      )
        .insert(chunk)
        .onConflict(['date', 'coin_gecko_coin_id'])
        .merge();
      insertedCount += result.rowCount;
    }
    console.log(`Updated ${insertedCount} prices`);
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
