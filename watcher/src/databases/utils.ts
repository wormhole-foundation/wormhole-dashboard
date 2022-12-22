import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { DB_SOURCE } from '../consts';
import { VaasByBlock } from './types';
import { BigtableDatabase } from './BigtableDatabase';
import { JsonDatabase } from './JsonDatabase';
import { Database } from './Database';
// // TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;
export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;
let database: Database = new Database();
export const initDb = async (): Promise<void> => {
  database = DB_SOURCE === 'bigtable' ? new BigtableDatabase() : new JsonDatabase();
};
export const getLastBlockByChain = async (chain: ChainName): Promise<string | null> => {
  return database.getLastBlockByChain(chain);
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
