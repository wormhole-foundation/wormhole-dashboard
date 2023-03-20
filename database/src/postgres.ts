import { chunkArray } from '@wormhole-foundation/wormhole-monitor-common';
import { Knex } from 'knex';

export const batchInsertOrIgnore = async (
  knex: Knex,
  tableName: string,
  data: any[],
  chunkSize: number = 1000
): Promise<number> => {
  const chunks = chunkArray(data, chunkSize);
  let insertedCount = 0;
  await knex.transaction(async (trx) => {
    for (const chunk of chunks) {
      const result: any = await trx(tableName).insert(chunk).onConflict().ignore();
      insertedCount += result.rowCount;
    }
  });
  return insertedCount;
};

export const assertHasTable = async (knex: Knex, tableName: string): Promise<void> => {
  if (!(await knex.schema.hasTable(tableName))) {
    throw new Error(`${tableName} table doesn't exist!`);
  }
};
