import { ChainName } from '@certusone/wormhole-sdk';
import { getLogger, WormholeLogger } from '../utils/logger';
import { DB, VaasByBlock } from './types';

export class Database {
  logger: WormholeLogger;
  constructor() {
    this.logger = getLogger('db');
  }
  static filterEmptyBlocks(vaasByBlock: VaasByBlock): VaasByBlock {
    const filteredVaasByBlock: VaasByBlock = {};
    for (const [block, vaas] of Object.entries(vaasByBlock)) {
      if (vaas.length > 0) filteredVaasByBlock[block] = [...vaas];
    }
    return filteredVaasByBlock;
  }
  async loadDb(): Promise<DB> {
    throw new Error('Not Implemented');
  }
  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    throw new Error('Not Implemented');
  }
  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    throw new Error('Not Implemented');
  }
}
