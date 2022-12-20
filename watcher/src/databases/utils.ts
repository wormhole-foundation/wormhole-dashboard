import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk';
import { DB_SOURCE } from '../consts';
import { DB, VaasByBlock } from './types';
import { FirestoreDatabase } from './FirestoreDatabase';
import { JsonDatabase } from './JsonDatabase';
// // TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;
export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;
let db: DB = {};
let database = DB_SOURCE === 'firestore' ? new FirestoreDatabase() : new JsonDatabase();
export const loadDb = async (): Promise<void> => {
  try {
    db = await database.loadDb();
  } catch (e) {
    db = {};
  }
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
