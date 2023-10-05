import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  MAX_UINT_64,
  padUint16,
  padUint64,
} from '@wormhole-foundation/wormhole-monitor-common';
import { DB_SOURCE } from '../consts';
import { BigtableDatabase } from './BigtableDatabase';
import { Database } from './Database';
import { JsonDatabase } from './JsonDatabase';
import { VaasByBlock } from './types';

// Bigtable Message ID format
// chain/MAX_UINT64-block/emitter/sequence
// 00002/00000000000013140651/0000000000000000000000008ea8874192c8c715e620845f833f48f39b24e222/00000000000000000000

export function makeMessageId(
  chainId: number,
  block: string,
  emitter: string,
  sequence: string
): string {
  return `${padUint16(chainId.toString())}/${padUint64(
    (BigInt(MAX_UINT_64) - BigInt(block)).toString()
  )}/${emitter}/${padUint64(sequence)}`;
}

export function parseMessageId(id: string): {
  chain: number;
  block: number;
  emitter: string;
  sequence: bigint;
} {
  const [chain, inverseBlock, emitter, sequence] = id.split('/');
  return {
    chain: parseInt(chain),
    block: Number(BigInt(MAX_UINT_64) - BigInt(inverseBlock)),
    emitter,
    sequence: BigInt(sequence),
  };
}

// TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;

export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;

// make a bigtable row key for the `vaasByTxHash` table
export const makeVAAsByTxHashRowKey = (txHash: string, chain: number): string =>
  `${txHash}/${padUint16(chain.toString())}`;

// make a bigtable row key for the `signedVAAs` table
export const makeSignedVAAsRowKey = (chain: number, emitter: string, sequence: string): string =>
  `${padUint16(chain.toString())}/${emitter}/${padUint64(sequence)}`;

let database: Database = new Database();
export const initDb = (startWatching: boolean = true): Database => {
  if (DB_SOURCE === 'bigtable') {
    database = new BigtableDatabase();
    if (startWatching) {
      console.log('Starting Bigtable watcher...');
      (database as BigtableDatabase).watchMissing();
    }
  } else {
    database = new JsonDatabase();
  }
  return database;
};

export const getResumeBlockByChain = async (chain: ChainName): Promise<number | null> => {
  const lastBlock = await database.getLastBlockByChain(chain);
  const initialBlock = INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain];
  return lastBlock !== null
    ? Number(lastBlock) + 1
    : initialBlock !== undefined
    ? Number(initialBlock)
    : null;
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
