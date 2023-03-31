import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import knex, { Knex } from 'knex';
import { MAX_VAA_DECIMALS } from '@certusone/wormhole-sdk';
import { Firestore } from 'firebase-admin/firestore';
import { TokenPrice } from '@wormhole-foundation/wormhole-monitor-database';
import { TVLHistory } from './types';

interface LockedToken {
  date: string;
  token_address: string;
  token_chain: number;
  coin_gecko_coin_id: string;
  decimals: number;
  amount_locked: string;
}

interface LockedTokensByDate {
  [date: string]: {
    [chain: string]: {
      [address: string]: LockedToken;
    };
  };
}

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export async function computeTVLHistory(req: any, res: any) {
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
        TO_CHAR(TO_TIMESTAMP(timestamp), 'YYYY-MM-DD') AS date,
        t.token_address,
        t.token_chain,
        m.coin_gecko_coin_id,
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
            MAX(sequence) AS sequence
          FROM
            ${assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE')}
          GROUP BY
            token_address,
            token_chain
        ) AS a ON t.token_address = a.token_address
        AND t.token_chain = a.token_chain
      WHERE
        m.coin_gecko_coin_id IS NOT NULL
        AND (
          t.emitter_chain = t.token_chain
          OR t.to_chain = t.token_chain
        )
      GROUP BY
        date,
        t.token_address,
        t.token_chain,
        m.coin_gecko_coin_id,
        a.decimals
      ORDER BY 
        date ASC
      `
    );
    const lockedTokens: LockedToken[] = result.rows;
    const prices = await pg<TokenPrice>(
      assertEnvironmentVariable('PG_TOKEN_PRICE_HISTORY_TABLE')
    ).select('*');
    const pricesByDate = prices.reduce<{ [date: string]: { [coinId: string]: number } }>(
      (result, price) => {
        const date = new Date(price.date).toISOString().slice(0, 10);
        result[date] = {
          ...result[date],
          [price.coin_gecko_coin_id]: price.price_usd,
        };
        return result;
      },
      {}
    );
    const allChains = new Set<number>();
    const lockedTokensByDate = lockedTokens.reduce<LockedTokensByDate>((result, lockedToken) => {
      const { date, token_chain, token_address } = lockedToken;
      result = {
        ...result,
        [date]: {
          ...result[date],
          [token_chain]: {
            ...result[date]?.[token_chain],
            [token_address]: {
              ...lockedToken,
            },
          },
        },
      };
      allChains.add(token_chain);
      return result;
    }, {});
    const tvlHistory: TVLHistory = {
      DailyLocked: {},
    };
    const today = new Date(Date.now());
    for (let date = new Date('2021-09-13'); date <= today; date = addDays(date, 1)) {
      const dateString = date.toISOString().slice(0, 10);
      // compute locked token cumulative amounts
      // TODO: do this in the SQL query
      if (lockedTokensByDate[dateString] === undefined) {
        lockedTokensByDate[dateString] = {};
      }
      const prevDateString = addDays(date, -1).toISOString().slice(0, 10);
      for (const lockedTokensByAddress of Object.values(lockedTokensByDate[prevDateString] || {})) {
        for (const lockedToken of Object.values(lockedTokensByAddress)) {
          const { token_chain, token_address, amount_locked } = lockedToken;
          if (lockedTokensByDate[dateString][token_chain] === undefined) {
            lockedTokensByDate[dateString][token_chain] = {};
          }
          lockedTokensByDate[dateString][token_chain][token_address] = {
            ...lockedToken,
            date: dateString,
            amount_locked: (
              BigInt(amount_locked) +
              BigInt(lockedTokensByDate[dateString][token_chain][token_address]?.amount_locked || 0)
            ).toString(),
          };
        }
      }
      tvlHistory.DailyLocked[dateString] = {
        '*': {
          '*': {
            Notional: 0,
          },
        },
      };
      for (const chain of allChains) {
        tvlHistory.DailyLocked[dateString][chain] = {
          '*': {
            Notional: 0,
          },
        };
        for (const lockedToken of Object.values(lockedTokensByDate[dateString][chain] || {})) {
          const { amount_locked, decimals, coin_gecko_coin_id } = lockedToken;
          const scaledAmountLocked =
            Number(amount_locked) / 10 ** Math.min(MAX_VAA_DECIMALS, decimals);
          const tokenPrice = pricesByDate[dateString]?.[coin_gecko_coin_id] || 0;
          const notional = scaledAmountLocked * tokenPrice;
          tvlHistory.DailyLocked[dateString][chain]['*'].Notional += notional;
          tvlHistory.DailyLocked[dateString]['*']['*'].Notional += notional;
        }
      }
    }
    const firestore = new Firestore();
    const collection = firestore.collection(
      assertEnvironmentVariable('FIRESTORE_TVL_HISTORY_COLLECTION')
    );
    // split into smaller docs since firestore has 1MB max doc size
    for (const [date, tvl] of Object.entries(tvlHistory.DailyLocked)) {
      await collection.doc(date).set(tvl);
    }
    console.log('Computed TVL history');
    res.sendStatus('200');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
  if (pg) {
    await pg.destroy();
  }
}
