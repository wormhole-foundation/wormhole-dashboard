import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { VaasByBlock } from '../databases/types';
import { getLogger, WormholeLogger } from '../utils/logger';

export class Watcher {
  chain: ChainName;
  logger: WormholeLogger;
  constructor(chain: ChainName) {
    this.chain = chain;
    this.logger = getLogger(chain);
  }
  async getFinalizedBlockNumber(): Promise<number> {
    throw new Error('Not Implemented');
  }
  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    throw new Error('Not Implemented');
  }
}
