import {
  ChainId,
  ChainName,
  chunks,
  coalesceChainId,
} from "@certusone/wormhole-sdk";
import { readFileSync, writeFileSync } from "fs";

// TODO: is number safe for the index?

export type VaasByBlock = { [block: number]: string[] };
export type DB = { [chain in ChainId]?: VaasByBlock };

const DB_FILE = "../server/db.json";
const ENCODING = "utf8";
let db: DB = {};

export const loadDb = (): void => {
  try {
    const raw = readFileSync(DB_FILE, ENCODING);
    db = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load DB, initiating a fresh one.");
  }
};

export const storeVaasByBlock = (
  chain: ChainName,
  vaasByBlock: VaasByBlock
): void => {
  const chainId = coalesceChainId(chain);
  db[chainId] = { ...(db[chainId] || {}), ...vaasByBlock };
  writeFileSync(DB_FILE, JSON.stringify(db), ENCODING);
};

export const getLastBlockByChain = (chain: ChainName): number | null => {
  const chainId = coalesceChainId(chain);
  const vaasByBlock = db[chainId];
  if (vaasByBlock) {
    const blocks = Object.keys(vaasByBlock);
    if (blocks.length) {
      return Number(blocks[blocks.length - 1]);
    }
  }
  return null;
};
