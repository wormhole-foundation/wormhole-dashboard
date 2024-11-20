import {
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  Mode,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { z } from 'zod';
import { HB_INTERVAL, TIMEOUT } from '../consts';
import { VaasByBlock } from '../databases/types';
import { getResumeBlockByChain, storeLatestBlock, storeVaasByBlock } from '../databases/utils';
import { getLogger, WormholeLogger } from '../utils/logger';
import { parentPort } from 'worker_threads';
import { Chain, Network } from '@wormhole-foundation/sdk-base';

export class Watcher {
  chain: Chain;
  network: Network;
  logger: WormholeLogger;
  maximumBatchSize: number = 100;
  mode: Mode;
  watchLoopDelay: number = 0; // in milliseconds

  constructor(network: Network, chain: Chain, mode: Mode = 'vaa') {
    this.network = network;
    this.chain = chain;
    this.mode = mode;

    // `vaa` -> 'VAA_'
    // `ntt` -> 'NTT_'
    // `ft` -> 'FT_'
    const loggerPrefix = mode.toUpperCase() + '_';
    this.logger = getLogger(loggerPrefix + chain);
  }

  async getFinalizedBlockNumber(): Promise<number> {
    throw new Error('Not Implemented');
  }

  async getMessagesForBlocks(
    fromBlock: number,
    toBlock: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    throw new Error('Not Implemented');
  }

  async getNttMessagesForBlocks(fromBlock: number, toBlock: number): Promise<string> {
    throw new Error('Not Implemented');
  }

  async getFtMessagesForBlocks(fromBlock: number, toBlock: number): Promise<string> {
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
    let fromBlock: number | null = await getResumeBlockByChain(this.network, this.chain, this.mode);

    let retry = 0;
    let firstTime = true;
    while (true) {
      try {
        this.logger.debug(`fromBlock = ${fromBlock}, toBlock = ${toBlock}`);
        if (fromBlock !== null && toBlock !== null && fromBlock <= toBlock) {
          // fetch logs for the block range, inclusive of toBlock
          toBlock = Math.min(fromBlock + this.maximumBatchSize - 1, toBlock);
          this.logger.info(`fetching messages from ${fromBlock} to ${toBlock}`);
          if (this.mode === 'ntt') {
            const blockKey = await this.getNttMessagesForBlocks(fromBlock, toBlock);
            await storeLatestBlock(this.chain, blockKey, this.mode);
          } else if (this.mode === 'ft') {
            const blockKey = await this.getFtMessagesForBlocks(fromBlock, toBlock);
            await storeLatestBlock(this.chain, blockKey, this.mode);
          } else {
            const { vaasByBlock, optionalBlockHeight } = await this.getMessagesForBlocks(
              fromBlock,
              toBlock
            );
            await storeVaasByBlock(this.chain, vaasByBlock);
            if (optionalBlockHeight) {
              toBlock = optionalBlockHeight;
            }
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
        this.logger.error(`error fetching messages: ${e}`);
        const expoBacko = TIMEOUT * 2 ** retry;
        this.logger.warn(`backing off for ${expoBacko}ms`);
        await sleep(expoBacko);
      }
      if (parentPort) {
        parentPort.postMessage('heartbeat');
      }
      if (this.watchLoopDelay > 0 && !firstTime) {
        this.logger.info(`Using watchLoopDelay of ${this.watchLoopDelay}ms`);
        const wakeupTime = Date.now() + this.watchLoopDelay;
        let now = Date.now();
        while (now < wakeupTime) {
          if (parentPort) {
            parentPort.postMessage('heartbeat');
          }
          const sleepInterval = Math.min(HB_INTERVAL / 2, wakeupTime - now);
          await sleep(sleepInterval);
          now = Date.now();
        }
        // After sleeping for the extra loop delay, need to get the latest finalized block
        try {
          toBlock = await this.getFinalizedBlockNumber();
          this.logger.debug(`finalized block after the extra loop delay = ${toBlock}`);
        } catch (e) {
          this.logger.error(`error fetching finalized block after the extra loop delay: ${e}`);
          // If this throws, the loop will continue and try again.
        }
      }
      firstTime = false;
    }
  }
}
