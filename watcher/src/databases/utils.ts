import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from '@wormhole-foundation/wormhole-monitor-common';
import { DB_SOURCE } from '../consts';
import { BigtableDatabase } from './BigtableDatabase';
import { Database } from './Database';
import { JsonDatabase } from './JsonDatabase';
import { VaasByBlock } from './types';
// // TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;
export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;
let database: Database = new Database();
export const initDb = (): Database => {
  database = DB_SOURCE === 'bigtable' ? new BigtableDatabase() : new JsonDatabase();
  return database;
};
export const getLastBlockByChain = async (chain: ChainName): Promise<number | null> => {
  const lastBlock: string =
    (await database.getLastBlockByChain(chain)) ?? INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain]!;
  return lastBlock === undefined ? null : Number(lastBlock);
};
export const storeVaasByBlock = async (
  chain: ChainName,
  vaasByBlock: VaasByBlock
): Promise<void> => {
  return database.storeVaasByBlock(chain, vaasByBlock);
};

export function printRow(rowkey: string, rowData: { [x: string]: any }) {
  console.log(`Reading data for ${rowkey}:`);

  for (const columnFamily of Object.keys(rowData)) {
    const columnFamilyData = rowData[columnFamily];
    console.log(`Column Family ${columnFamily}`);

    for (const columnQualifier of Object.keys(columnFamilyData)) {
      const col = columnFamilyData[columnQualifier];

      for (const cell of col) {
        const labels = cell.labels.length ? ` [${cell.labels.join(',')}]` : '';
        console.log(`\t${columnQualifier}: ${cell.value} @${cell.timestamp}${labels}`);
      }
    }
  }
  console.log();
}
