import { ChainName } from '@certusone/wormhole-sdk';
import { VaasByBlock } from '../db';
import { getLogger, WormholeLogger } from '../utils/logger';

export class Watcher {
  chain: ChainName;
  logger: WormholeLogger;
  constructor(chain: ChainName) {
    this.chain = chain;
    this.logger = getLogger(chain);
  }
  async getFinalizedBlockNumber(): Promise<number | null> {
    throw new Error('Not Implemented');
  }
  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    throw new Error('Not Implemented');
  }
}
