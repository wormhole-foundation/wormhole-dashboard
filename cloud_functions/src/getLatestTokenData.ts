import { assertEnvironmentVariable } from './utils';
import knex from 'knex';

export type TokenData = {
  token_chain: number;
  token_address: string;
  native_address: string;
  coin_gecko_coin_id: string;
  decimals: number;
  symbol: string;
  name: string;
  price_usd: number;
};

export type TokenCache = {
  data?: TokenData[];
};

async function getLatestTokenData_(): Promise<TokenData[]> {
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
    const mdTable = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
    const pxTable = assertEnvironmentVariable('PG_TOKEN_PRICE_HISTORY_TABLE');
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const result = await pg.raw(
      `SELECT ${mdTable}.*, ${pxTable}.price_usd FROM ${mdTable}, ${pxTable} \
      WHERE ${mdTable}.coin_gecko_coin_id = ${pxTable}.coin_gecko_coin_id AND ${pxTable}.date = '${today}'`
    );
    const rows: TokenData[] = result.rows;
    return rows;
  } catch (e) {
    console.error(`Error getting token metadata: ${e}`);
    throw e;
  }
}

let cache = { values: {} as TokenCache, lastUpdated: Date.now() };
// default refresh interval = 5 min
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 5;

export async function getLatestTokenData(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  let values: TokenCache = {};
  try {
    if (
      Object.keys(cache['values']).length === 0 ||
      Date.now() - cache['lastUpdated'] > REFRESH_TIME_INTERVAL
    ) {
      if (Object.keys(cache['values']).length === 0) {
        console.log(`cache is empty, setting cache[values] ${new Date()}`);
      } else {
        console.log(`cache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`);
      }
      let prevDate = Date.now();
      const innerValues = await getLatestTokenData_();
      values = { data: innerValues };
      let timeDiff = Date.now() - prevDate;
      console.log('After getLatestTokenData =', timeDiff);
      cache['values'] = values;
      cache['lastUpdated'] = Date.now();
    } else {
      console.log(`cache is still valid, not refreshing ${new Date()}`);
      values = cache['values'];
    }
    res.status(200).send(JSON.stringify(values));
  } catch (e) {
    console.error(`Error getting latest token data: ${e}`);
    res.sendStatus(500);
  }
}
