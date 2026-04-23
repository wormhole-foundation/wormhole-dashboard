import { Chain, Network, chainToChainId } from '@wormhole-foundation/sdk-base';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_MODE,
  Mode,
  padUint16,
  padUint64,
} from '@wormhole-foundation/wormhole-monitor-common';
import { DB_SOURCE } from '../consts';
import { Database } from './Database';
import { FirestoreDatabase } from './FirestoreDatabase';
import { JsonDatabase } from './JsonDatabase';
import { VaasByBlock } from './types';
export { makeMessageId, parseMessageId } from '@wormhole-foundation/wormhole-monitor-common';

// TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;

export const extractBlockFromKey = (key: string): number => {
  return parseInt(key.split('/')[0]);
};

export const makeVaaKey = (
  transactionHash: string,
  chain: Chain,
  emitter: string,
  seq: string
): string => `${transactionHash}:${chainToChainId(chain)}/${emitter}/${seq}`;

// composite key for the `signedVAAs` Firestore collection
export const makeSignedVAAsRowKey = (chain: number, emitter: string, sequence: string): string =>
  `${padUint16(chain.toString())}/${emitter}/${padUint64(sequence)}`;

let database: Database = new Database();
export const initDb = (startWatching: boolean = true): Database => {
  if (DB_SOURCE === 'firestore') {
    database = new FirestoreDatabase();
    if (startWatching) {
      console.log('Starting Firestore watcher...');
      (database as FirestoreDatabase).watchMissing();
    }
  } else {
    database = new JsonDatabase();
  }
  return database;
};

export const storeLatestBlock = async (
  chain: Chain,
  lastBlockKey: string,
  mode: Mode
): Promise<void> => {
  return database.storeLatestBlock(chain, lastBlockKey, mode);
};

export const getResumeBlockByChain = async (
  network: Network,
  chain: Chain,
  mode: Mode
): Promise<number | null> => {
  const lastBlock = await database.getLastBlockByChain(chain, mode);
  const initialBlock = INITIAL_DEPLOYMENT_BLOCK_BY_MODE[mode][network][chain];
  return lastBlock !== null
    ? Number(lastBlock) + 1
    : initialBlock !== undefined
    ? Number(initialBlock)
    : null;
};

export const storeVaasByBlock = async (chain: Chain, vaasByBlock: VaasByBlock): Promise<void> => {
  return database.storeVaasByBlock(chain, vaasByBlock);
};
