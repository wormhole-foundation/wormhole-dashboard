import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk';
import { readFileSync, writeFileSync } from 'fs';

export type VaasByBlock = { [blockInfo: string]: string[] };
export type DB = { [chain in ChainId]?: VaasByBlock };

const DB_FILE = '../server/db.json';
const ENCODING = 'utf8';
let db: DB = {};

export const loadDb = (): void => {
  try {
    const raw = readFileSync(DB_FILE, ENCODING);
    db = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load DB, initiating a fresh one.');
  }
};

// TODO: should this be a composite key or should the value become more complex
export const makeBlockKey = (block: string, timestamp: string): string => `${block}/${timestamp}`;

export const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
): string => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;

export const storeVaasByBlock = (chain: ChainName, vaasByBlock: VaasByBlock): void => {
  const chainId = coalesceChainId(chain);
  db[chainId] = { ...(db[chainId] || {}), ...vaasByBlock };
  writeFileSync(DB_FILE, JSON.stringify(db), ENCODING);
};

export const getLastBlockByChain = (chain: ChainName): string | null => {
  const chainId = coalesceChainId(chain);
  const vaasByBlock = db[chainId];
  if (vaasByBlock) {
    const blockInfos = Object.keys(vaasByBlock);
    if (blockInfos.length) {
      return blockInfos[blockInfos.length - 1].split('/')[0];
    }
  }
  return null;
};
