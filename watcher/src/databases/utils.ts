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

// Bigtable VAA ID format
// chain:emitter:sequence
// 2:00000000000000000000000005b70fb5477a93be33822bfb31fdaf2c171970df:0000000000000000

export function makeVaaId(chain: number, emitter: string, sequence: bigint) {
  return `${chain}:${emitter}:${sequence.toString().padStart(16, '0')}`;
}

// TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;

export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;

let database: Database = new Database();
export const initDb = (): Database => {
  if (DB_SOURCE === 'bigtable') {
    database = new BigtableDatabase();
    (database as BigtableDatabase).watchMissing();
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
