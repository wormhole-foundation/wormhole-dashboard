import { decode } from 'bs58';
import { Provider, TypedError } from 'near-api-js/lib/providers';
import { BlockResult } from 'near-api-js/lib/providers/provider';
import { z } from 'zod';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { getMessagesFromBlockResults, getNearProvider } from '../utils/near';
import { Watcher } from './Watcher';
import { Network } from '@wormhole-foundation/sdk-base';

export class NearWatcher extends Watcher {
  provider: Provider | null = null;

  constructor(network: Network) {
    super(network, 'Near');
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);
    const provider = await this.getProvider();
    const block = await provider.block({ finality: 'final' });
    return block.header.height;
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    // assume toBlock was retrieved from getFinalizedBlockNumber and is finalized
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);
    const provider = await this.getProvider();
    const blocks: BlockResult[] = [];
    let block: BlockResult | null = null;
    try {
      block = await provider.block({ blockId: toBlock });
      blocks.push(block);
      while (true) {
        // traverse backwards via block hashes: https://github.com/wormhole-foundation/wormhole-monitor/issues/35
        block = await provider.block({ blockId: block.header.prev_hash });
        if (block.header.height < fromBlock) break;
        blocks.push(block);
      }
    } catch (e) {
      if (e instanceof TypedError && e.type === 'HANDLER_ERROR') {
        const error = block
          ? `block ${block.header.prev_hash} is too old, use backfillNear for blocks before height ${block.header.height}`
          : `toBlock ${toBlock} is too old, use backfillNear for this range`; // starting block too old
        this.logger.error(error);
      } else {
        throw e;
      }
    }

    return getMessagesFromBlockResults(this.network, provider, blocks);
  }

  async getProvider(): Promise<Provider> {
    return (this.provider =
      this.provider || (await getNearProvider(this.network, RPCS_BY_CHAIN[this.network].Near!)));
  }

  isValidVaaKey(key: string) {
    try {
      const [txHash, vaaKey] = key.split(':');
      const txHashDecoded = Buffer.from(decode(txHash)).toString('hex');
      const [_, emitter, sequence] = vaaKey.split('/');
      return (
        /^[0-9a-fA-F]{64}$/.test(z.string().parse(txHashDecoded)) &&
        /^[0-9a-fA-F]{64}$/.test(z.string().parse(emitter)) &&
        z.number().int().parse(Number(sequence)) >= 0
      );
    } catch (e) {
      return false;
    }
  }
}
