import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { connect } from 'near-api-js';
import { Provider, TypedError } from 'near-api-js/lib/providers';
import { BlockResult, ExecutionStatus } from 'near-api-js/lib/providers/provider';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { EventLog, isWormholePublishEventLog } from '../types/near';
import { Watcher } from './Watcher';

export class NearWatcher extends Watcher {
  provider: Provider | null = null;

  constructor() {
    super('near');
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
    let block = await provider.block(toBlock);
    try {
      blocks.push(block);
      while (true) {
        // traverse backwards via block hashes: https://github.com/wormhole-foundation/wormhole-monitor/issues/35
        block = await provider.block(block.header.prev_hash);
        if (block.header.height < fromBlock) break;
        blocks.push(block);
      }
    } catch (e) {
      if (e instanceof TypedError && e.type === 'HANDLER_ERROR') {
        this.logger.error(
          `block height for block ${block.header.prev_hash} is too old for rpc, use backfillNear to fetch blocks before height ${block.header.height}`
        );
      } else {
        throw e;
      }
    }

    return this.getMessagesFromBlockResults(blocks);
  }

  async getMessagesFromBlockResults(blocks: BlockResult[]): Promise<VaasByBlock> {
    const provider = await this.getProvider();
    const vaasByBlock: VaasByBlock = {};
    for (const block of blocks) {
      const chunks = await Promise.all(
        block.chunks.map(({ chunk_hash }) => provider.chunk(chunk_hash))
      );
      const transactions = chunks.flatMap(({ transactions }) => transactions);
      for (const tx of transactions) {
        const outcome = await provider.txStatus(tx.hash, CONTRACTS.MAINNET.near.core);
        if (
          (outcome.status as ExecutionStatus).SuccessValue ||
          (outcome.status as ExecutionStatus).SuccessReceiptId
        ) {
          const logs = outcome.receipts_outcome
            .filter(({ outcome }) => (outcome as any).executor_id === CONTRACTS.MAINNET.near.core)
            .flatMap(({ outcome }) => outcome.logs)
            .filter((log) => log.startsWith('EVENT_JSON:')) // https://nomicon.io/Standards/EventsFormat
            .map((log) => JSON.parse(log.slice(11)) as EventLog)
            .filter(isWormholePublishEventLog);
          for (const log of logs) {
            const { height, timestamp } = block.header;
            const blockKey = makeBlockKey(height.toString(), timestamp.toString());
            const vaaKey = makeVaaKey(tx.hash, this.chain, log.emitter, log.seq.toString());
            vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
          }
        }
      }
    }

    return vaasByBlock;
  }

  async getProvider(): Promise<Provider> {
    if (!this.provider) {
      const connection = await connect({ nodeUrl: RPCS_BY_CHAIN.near!, networkId: 'mainnet' });
      this.provider = connection.connection.provider;
    }
    return this.provider;
  }
}
