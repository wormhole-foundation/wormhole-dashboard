import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  Environment,
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { z } from 'zod';
import { TIMEOUT } from '../consts';
import { VaasByBlock } from '../databases/types';
import { getResumeBlockByChain, storeLatestBlock, storeVaasByBlock } from '../databases/utils';
import { getLogger, WormholeLogger } from '../utils/logger';

export class Watcher {
  chain: ChainName;
  network: Environment;
  logger: WormholeLogger;
  maximumBatchSize: number = 100;
  isNTT: boolean = false;

  constructor(network: Environment, chain: ChainName, isNTT: boolean = false) {
    this.network = network;
    this.chain = chain;
    this.isNTT = isNTT;
    this.logger = isNTT ? getLogger('NTT_' + chain) : getLogger(chain);
  }

  async getFinalizedBlockNumber(): Promise<number> {
    throw new Error('Not Implemented');
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    throw new Error('Not Implemented');
  }

  async getNttMessagesForBlocks(fromBlock: number, toBlock: number): Promise<string> {
    throw new Error('Not Implemented');
  }

  isValidBlockKey(key: string) {
    try {
      const [block, timestamp] = key.split('/');
      const initialBlock = z
        .number()
        .int()
        .parse(Number(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN[this.network][this.chain]));
      return (
        z.number().int().parse(Number(block)) > initialBlock &&
        Date.parse(z.string().datetime().parse(timestamp)) < Date.now()
      );
    } catch (e) {
      return false;
    }
  }

  isValidVaaKey(key: string): boolean {
    throw new Error('Not Implemented');
  }

  async watch(): Promise<void> {
    let toBlock: number | null = null;
    let fromBlock: number | null = await getResumeBlockByChain(
      this.network,
      this.chain,
      this.isNTT
    );

    let retry = 0;
    while (true) {
      try {
        this.logger.debug(`fromBlock = ${fromBlock}, toBlock = ${toBlock}`);
        if (fromBlock !== null && toBlock !== null && fromBlock <= toBlock) {
          // fetch logs for the block range, inclusive of toBlock
          toBlock = Math.min(fromBlock + this.maximumBatchSize - 1, toBlock);
          this.logger.info(`fetching messages from ${fromBlock} to ${toBlock}`);
          if (this.isNTT) {
            const blockKey = await this.getNttMessagesForBlocks(fromBlock, toBlock);
            await storeLatestBlock(this.chain, blockKey, true);
          } else {
            const vaasByBlock = await this.getMessagesForBlocks(fromBlock, toBlock);
            await storeVaasByBlock(this.chain, vaasByBlock);
          }
          fromBlock = toBlock + 1;
        }
        try {
          this.logger.info('fetching finalized block');
          toBlock = await this.getFinalizedBlockNumber();
          this.logger.debug(`finalized block = ${toBlock}`);
          if (fromBlock === null) {
            // handle first loop on a fresh chain without initial block set
            fromBlock = toBlock;
          }
          retry = 0;
          this.logger.debug(`fromBlock = ${fromBlock}, toBlock = ${toBlock}`);
          await sleep(TIMEOUT);
        } catch (e) {
          // skip attempting to fetch messages until getting the finalized block succeeds
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
