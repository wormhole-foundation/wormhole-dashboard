import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { decode } from 'bs58';
import { Provider } from 'near-api-js/lib/providers';
import { BlockResult, ExecutionStatus } from 'near-api-js/lib/providers/provider';
import ora from 'ora';
import { z } from 'zod';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { EventLog, Transaction } from '../types/near';
import {
  NEAR_ARCHIVE_RPC,
  fetchBlockByBlockId,
  getNearProvider,
  getTimestampByBlock,
  getTransactionsByAccountId,
  isWormholePublishEventLog,
} from '../utils/near';
import { Watcher } from './Watcher';
import { sleep } from '@wormhole-foundation/wormhole-monitor-common';

export class NearArchiveWatcher extends Watcher {
  provider: Provider | null = null;

  constructor() {
    super('near');
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);
    const provider = await this.getProvider();
    try {
      const block = await provider.block({ finality: 'final' });
      console.log('getFinalizedBlockNumber', block.header.height);
      return block.header.height;
    } catch (e) {
      this.logger.error('getFinalizedBlockNumber(): Error fetching block', e);
      throw e;
    }
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    // assume toBlock was retrieved from getFinalizedBlockNumber and is finalized
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);
    const provider = await this.getProvider();
    const fromBlockTimestamp: number = await getTimestampByBlock(provider, fromBlock);
    if (fromBlockTimestamp === 0) {
      this.logger.error(`Unable to fetch timestamp for block ${fromBlock}`);
      throw new Error(`Unable to fetch timestamp for fromBlock ${fromBlock}`);
    }
    const toBlockInfo: BlockResult | string = await fetchBlockByBlockId(provider, toBlock);
    if (typeof toBlockInfo === 'string') {
      this.logger.error(`Unable to fetchBlockByBlockId(${toBlockInfo} error: ${toBlockInfo}`);
      // It's okay to throw here the calling code will do exponential backoff.
      throw new Error(toBlockInfo);
    }
    const transactions: Transaction[] = await getTransactionsByAccountId(
      CONTRACTS.MAINNET.near.core,
      this.maximumBatchSize,
      fromBlockTimestamp,
      toBlockInfo.header.timestamp.toString().padEnd(19, '9') // pad to nanoseconds
    );
    this.logger.info(`Fetched ${transactions.length} transactions from NEAR Explorer`);

    // filter out transactions that precede last seen block
    const blocks: BlockResult[] = [];
    const blockHashes = [...new Set(transactions.map((tx) => tx.blockHash))]; // de-dup blocks
    for (let i = 0; i < blockHashes.length; i++) {
      let success: boolean = false;
      while (!success) {
        try {
          const block = await fetchBlockByBlockId(provider, blockHashes[i]);
          if (typeof block === 'string') {
            this.logger.error(block);
            throw new Error(block);
          }
          if (block.header.height > fromBlock && block.header.height <= toBlockInfo.header.height) {
            blocks.push(block);
          }
          success = true;
        } catch (e) {
          console.error('Error fetching block', e);
          await sleep(5000);
        }
      }
    }

    this.logger.info(`Fetched ${blocks.length} blocks`);
    const vaasByBlock: VaasByBlock = await getMessagesFromBlockResults(provider, blocks, true);
    // Make a block for the to_block, if it isn't already there
    const blockKey = makeBlockKey(
      toBlockInfo.header.height.toString(),
      new Date(toBlockInfo.header.timestamp / 1_000_000).toISOString()
    );
    if (!vaasByBlock[blockKey]) {
      vaasByBlock[blockKey] = [];
    }
    return vaasByBlock;
  }

  async getProvider(): Promise<Provider> {
    return (this.provider = this.provider || (await getNearProvider(NEAR_ARCHIVE_RPC)));
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

export const getMessagesFromBlockResults = async (
  provider: Provider,
  blocks: BlockResult[],
  debug: boolean = false
): Promise<VaasByBlock> => {
  const vaasByBlock: VaasByBlock = {};
  let log: ora.Ora;
  if (debug) log = ora(`Fetching messages from ${blocks.length} blocks...`).start();
  for (let i = 0; i < blocks.length; i++) {
    if (debug) log!.text = `Fetching messages from block ${i + 1}/${blocks.length}...`;
    const { height, timestamp } = blocks[i].header;
    const blockKey = makeBlockKey(height.toString(), new Date(timestamp / 1_000_000).toISOString());
    vaasByBlock[blockKey] = [];

    const chunks = [];
    for (const chunk of blocks[i].chunks) {
      chunks.push(await provider.chunk(chunk.chunk_hash));
    }

    const transactions = chunks.flatMap(({ transactions }) => transactions);
    for (const tx of transactions) {
      const outcome = await provider.txStatus(tx.hash, CONTRACTS.MAINNET.near.core);
      const logs = outcome.receipts_outcome
        .filter(
          ({ outcome }) =>
            (outcome as any).executor_id === CONTRACTS.MAINNET.near.core &&
            (outcome.status as ExecutionStatus).SuccessValue
        )
        .flatMap(({ outcome }) => outcome.logs)
        .filter((log) => log.startsWith('EVENT_JSON:')) // https://nomicon.io/Standards/EventsFormat
        .map((log) => JSON.parse(log.slice(11)) as EventLog)
        .filter(isWormholePublishEventLog);
      for (const log of logs) {
        const vaaKey = makeVaaKey(tx.hash, 'near', log.emitter, log.seq.toString());
        vaasByBlock[blockKey] = [...vaasByBlock[blockKey], vaaKey];
      }
    }
  }

  if (debug) {
    const numMessages = Object.values(vaasByBlock).flat().length;
    log!.succeed(`Fetched ${numMessages} messages from ${blocks.length} blocks`);
  }

  return vaasByBlock;
};
