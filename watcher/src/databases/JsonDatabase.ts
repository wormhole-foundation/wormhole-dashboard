import { ChainName, coalesceChainId } from '@certusone/wormhole-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { DB_FILE } from '../consts';
import { Database } from './Database';
import { DB, VaasByBlock } from './types';

const ENCODING = 'utf8';
export class JsonDatabase extends Database {
  db: DB;
  dbFile: string;
  constructor() {
    super();
    this.db = {};
    if (!process.env.DB_FILE) {
      this.logger.info(`no db file set, using default path=${DB_FILE}`);
    }
    this.dbFile = DB_FILE;
  }
  async loadDb(): Promise<DB> {
    try {
      const raw = readFileSync(this.dbFile, ENCODING);
      this.db = JSON.parse(raw);
    } catch (e) {
      this.logger.warn('Failed to load DB, initiating a fresh one.');
      this.db = {};
    }
    return this.db;
  }
  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    const chainId = coalesceChainId(chain);
    const vaasByBlock = this.db[chainId];
    if (vaasByBlock) {
      const blockInfos = Object.keys(vaasByBlock);
      if (blockInfos.length) {
        return blockInfos[blockInfos.length - 1].split('/')[0];
      }
    }
    return null;
  }
  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    const chainId = coalesceChainId(chain);
    this.db[chainId] = { ...(this.db[chainId] || {}), ...vaasByBlock };
    writeFileSync(this.dbFile, JSON.stringify(this.db), ENCODING);
  }
}
