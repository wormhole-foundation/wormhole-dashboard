import { getLogger, WormholeLogger } from '../utils/logger';
import { VaasByBlock } from './types';
import { Chain } from '@wormhole-foundation/sdk-base';

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
  async getLastBlockByChain(chain: Chain, isNTT: boolean): Promise<string | null> {
    throw new Error('Not Implemented');
  }
  async storeVaasByBlock(chain: Chain, vaasByBlock: VaasByBlock): Promise<void> {
    throw new Error('Not Implemented');
  }
  async storeLatestBlock(chain: Chain, lastBlockKey: string, isNTT: boolean): Promise<void> {
    throw new Error('Not Implemented');
  }
}
