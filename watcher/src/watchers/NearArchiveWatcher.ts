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
  fetchBlockByBlockId,
  getNearProvider,
  getTimestampByBlock,
  getTransactionsByAccountId,
  isWormholePublishEventLog,
} from '../utils/near';
import { Watcher } from './Watcher';
import {
  Environment,
  assertEnvironmentVariable,
} from '@wormhole-foundation/wormhole-monitor-common';

export class NearArchiveWatcher extends Watcher {
  provider: Provider | null = null;

  constructor(network: Environment) {
    super(network, 'near');
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);
    const provider = await this.getProvider();
    try {
      const block = await provider.block({ finality: 'final' });
      console.log('getFinalizedBlockNumber', block.header.height);
      return block.header.height;
    } catch (e) {
      this.logger.error(`getFinalizedBlockNumber(): Error fetching block: ${e}`);
      throw e;
    }
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    const origFromBlock = fromBlock;
    const origToBlock = toBlock;
    this.logger.info(`fetching info for blocks ${origFromBlock} to ${origToBlock}`);
    const provider = await this.getProvider();
    // Do the following in a while loop until a fromBlock has been found.
    let fromBlockTimestamp: number = 0;
    let done: boolean = false;
    while (!done) {
      try {
        fromBlockTimestamp = await getTimestampByBlock(provider, fromBlock);
        done = true;
      } catch (e) {
        // Logging this to help with troubleshooting.
        this.logger.debug(e);
        this.logger.error(`getMessagesForBlocks(): Error fetching from block ${fromBlock}`);
        fromBlock++;
        if (fromBlock > toBlock) {
          this.logger.error(
            `Unable to fetch timestamp for fromBlock in range ${origFromBlock} - ${origToBlock}`
          );
          throw new Error(
            `Unable to fetch timestamp for fromBlock in range ${origFromBlock} - ${origToBlock}`
          );
        }
      }
    }
    if (fromBlockTimestamp === 0) {
      this.logger.error(`Unable to fetch timestamp for fromBlock ${fromBlock}`);
      throw new Error(`Unable to fetch timestamp for fromBlock ${fromBlock}`);
    }
    let toBlockInfo: BlockResult = {} as BlockResult;
    done = false;
    while (!done) {
      try {
        toBlockInfo = await fetchBlockByBlockId(provider, toBlock);
        done = true;
      } catch (e) {
        // Logging this to help with troubleshooting.
        this.logger.debug(e);
        this.logger.error(`getMessagesForBlocks(): Error fetching toBlock ${toBlock}`);
        toBlock--;
        if (toBlock < fromBlock) {
          this.logger.error(
            `Unable to fetch block info for toBlock in range ${origFromBlock} - ${origToBlock}`
          );
          throw new Error(
            `Unable to fetch block info for toBlock in range ${origFromBlock} - ${origToBlock}`
          );
        }
      }
    }
    this.logger.info(`Actual block range: ${fromBlock} - ${toBlock}`);
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
      // If the following throws, it will trigger exponential backoff and retry
      const block = await fetchBlockByBlockId(provider, blockHashes[i]);
      if (block.header.height > fromBlock && block.header.height <= toBlockInfo.header.height) {
        blocks.push(block);
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
    const nearArchiveRPC: string = assertEnvironmentVariable('NEAR_ARCHIVE_RPC');
    return (this.provider = this.provider || (await getNearProvider(this.network, nearArchiveRPC)));
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
