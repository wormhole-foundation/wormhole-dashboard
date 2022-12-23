import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { getMaximumBatchSize, TIMEOUT } from '../consts';
import { VaasByBlock } from '../databases/types';
import { getLastBlockByChain, storeVaasByBlock } from '../databases/utils';
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

  async watch() {
    let toBlock: number | null = null;
    const lastReadBlock: string | null =
      (await getLastBlockByChain(this.chain)) ||
      INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[this.chain] ||
      null;
    let fromBlock: number | null = lastReadBlock !== null ? Number(lastReadBlock) : toBlock;
    let retry = 0;
    while (true) {
      try {
        if (fromBlock && toBlock && fromBlock <= toBlock) {
          // fetch logs for the block range
          toBlock = Math.min(fromBlock + getMaximumBatchSize(this.chain) - 1, toBlock); // fix for "block range is too wide" or "maximum batch size is 50, but received 101"
          this.logger.info(`fetching messages from ${fromBlock} to ${toBlock}`);
          const vaasByBlock = await this.getMessagesForBlocks(fromBlock, toBlock);
          await storeVaasByBlock(this.chain, vaasByBlock);
          fromBlock = toBlock + 1;
          await sleep(TIMEOUT);
        }
        try {
          this.logger.info('fetching finalized block');
          toBlock = await this.getFinalizedBlockNumber();
          retry = 0;
        } catch (e) {
          toBlock = null;
          this.logger.error(`error fetching finalized block`);
          throw e;
        }
      } catch (e) {
        retry++;
        this.logger.error(e);
        const expoBacko = TIMEOUT * 2 ** retry;
        this.logger.warn(`backing off for ${expoBacko}ms`);
        await sleep(expoBacko);
      }
    }
  }
}
