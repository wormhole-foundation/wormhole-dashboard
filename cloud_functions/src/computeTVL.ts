import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import knex, { Knex } from 'knex';
import { MAX_VAA_DECIMALS } from '@certusone/wormhole-sdk';
import { Firestore } from 'firebase-admin/firestore';
import { fetchPrices } from '@wormhole-foundation/wormhole-monitor-database';
import { NotionalTVL } from './types';

export async function computeTVL(req: any, res: any) {
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
    // TODO: don't use a raw query
    const result = await pg.raw(
      `
      SELECT
      t.token_address,
      t.token_chain,
      m.coin_gecko_coin_id,
      m.native_address,
      a.name,
      a.symbol,
      a.decimals,
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
      INNER JOIN (
        SELECT
          token_address,
          token_chain,
          MAX(decimals) AS decimals,
          MAX(sequence) AS sequence,
          MAX(name) AS name,
          MAX(symbol) AS symbol
        FROM
          ${assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE')}
        GROUP BY
          token_address,
          token_chain
      ) AS a ON t.token_address = a.token_address
      AND t.token_chain = a.token_chain
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
      a.name,
      a.symbol,
      a.decimals
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
      const scaledAmountLocked =
        Number(amount_locked) / 10 ** Math.min(MAX_VAA_DECIMALS, decimals);
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
    const firestore = new Firestore();
    const collection = firestore.collection(
      assertEnvironmentVariable('FIRESTORE_TVL_COLLECTION')
    );
    await collection.doc('tvl').set(notionalTvl);
    console.log('Computed TVL');
    res.sendStatus('200');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
  if (pg) {
    await pg.destroy();
  }
}
