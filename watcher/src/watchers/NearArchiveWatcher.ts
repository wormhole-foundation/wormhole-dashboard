import { decode } from 'bs58';
import { Provider } from 'near-api-js/lib/providers';
import { BlockResult, ExecutionStatus } from 'near-api-js/lib/providers/provider';
import { z } from 'zod';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import {
  fetchBlockByBlockId,
  getNearProvider,
  getTimestampByBlock,
  isWormholePublishEventLog,
} from '../utils/near';
import { Watcher } from './Watcher';
import { assertEnvironmentVariable, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import { Network, contracts } from '@wormhole-foundation/sdk-base';
import axios from 'axios';
import { AXIOS_CONFIG_JSON, HB_INTERVAL } from '../consts';
import { EventLog } from 'src/types/near';

export class NearArchiveWatcher extends Watcher {
  provider: Provider | null = null;

  constructor(network: Network) {
    super(network, 'Near', 'vaa');
    this.maximumBatchSize = 1_000_000;
    this.watchLoopDelay = 60 * 60 * 1000; // 1 hour
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

  async getMessagesForBlocks(
    fromBlock: number,
    toBlock: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    const quittingTimestamp = Date.now() + HB_INTERVAL * 0.75;
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
        this.logger.debug(`fromBlockTimestamp: ${fromBlockTimestamp}`);
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
    const coreContract = contracts.coreBridge.get(this.network, this.chain);
    if (!coreContract) {
      throw new Error(`Unable to get contract address for ${this.chain}`);
    }
    const transactions: NearTxn[] = await this.getTransactionsByAccountId(
      coreContract,
      fromBlockTimestamp,
      toBlockInfo.header.timestamp.toString().padEnd(19, '9') // pad to nanoseconds
    );
    this.logger.info(`Fetched ${transactions.length} transactions from NEAR Explorer`);

    // filter out transactions that precede last seen block
    const blocks: BlockResult[] = [];
    const blockHashes = [...new Set(transactions.map((tx) => tx.included_in_block_hash))]; // de-dup blocks
    for (let i = 0; i < blockHashes.length; i++) {
      // If the following throws, it will trigger exponential backoff and retry
      const block = await fetchBlockByBlockId(provider, blockHashes[i]);
      if (block.header.height > fromBlock && block.header.height <= toBlockInfo.header.height) {
        blocks.push(block);
      }
    }

    this.logger.info(`Fetched ${blocks.length} blocks`);
    const response: ConstrainedResponse = await this.getMessagesFromBlockResultsConstrained(
      this.network,
      provider,
      blocks,
      quittingTimestamp
    );
    // This is the case where there are no transactions in the time window.
    if (response.lastBlockHeight === 0) {
      response.lastBlockHeight = toBlock;
    }
    const lastBlockInfo = await fetchBlockByBlockId(provider, response.lastBlockHeight);
    // Make a block for the to_block, if it isn't already there
    const blockKey = makeBlockKey(
      response.lastBlockHeight.toString(),
      new Date(lastBlockInfo.header.timestamp / 1_000_000).toISOString()
    );
    if (!response.vaasByBlock[blockKey]) {
      response.vaasByBlock[blockKey] = [];
    }
    return response;
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
  // This function will only return transactions in the time window.
  async getTransactionsByAccountId(
    accountId: string,
    beginningTimestamp: number,
    endingTimestamp: string
  ): Promise<NearTxn[]> {
    console.log(`Fetching transactions in range [${beginningTimestamp}, ${endingTimestamp}]...`);
    const txs: NearTxn[] = [];
    let done: boolean = false;

    let page = 1;
    while (!done) {
      this.logger.debug(`Fetching transactions for page ${page}...`);
      // https://api3.nearblocks.io/v1/account/contract.wormhole_crypto.near/txns?method=publish_message&order=desc&page=1&per_page=25
      const res = await axios.get<GetTransactionsByAccountIdResponse>(
        `https://api3.nearblocks.io/v1/account/${accountId}/txns?method=publish_message&order=desc&page=${page}&per_page=25`,
        AXIOS_CONFIG_JSON
      );
      // console.log(`Fetched ${JSON.stringify(res)}`);
      page++;
      for (const tx of res.data.txns) {
        // Need to pad the timestamp to 19 digits to match the timestamp format in the NearTxn object.
        const paddedTimestamp: number = Number(tx.block_timestamp.padEnd(19, '0'));
        this.logger.debug(
          `Checking transaction ${tx.transaction_hash} at block timestamp ${tx.block_timestamp}...`
        );
        if (paddedTimestamp >= beginningTimestamp && paddedTimestamp <= Number(endingTimestamp)) {
          this.logger.debug(
            `Transaction ${tx.transaction_hash} at block ${paddedTimestamp} is in range of [${beginningTimestamp}, ${endingTimestamp}].`
          );
          txs.push(tx);
        } else if (paddedTimestamp < beginningTimestamp) {
          // This transaction is older than the beginning timestamp, so we're done.
          done = true;
          break;
        }
      }
      await sleep(10_000);
    }
    return txs.reverse();
  }

  async getMessagesFromBlockResultsConstrained(
    network: Network,
    provider: Provider,
    blocks: BlockResult[],
    quittingTime: number
  ): Promise<ConstrainedResponse> {
    const vaasByBlock: VaasByBlock = {};
    let lastBlockHeight = 0;
    let prevLastBlockHeight = 0;
    this.logger.debug(`Fetching messages from ${blocks.length} blocks...`);
    try {
      for (let i = 0; i < blocks.length; i++) {
        this.logger.debug(`Fetching messages from block ${i + 1}/${blocks.length}...`);
        const { height, timestamp } = blocks[i].header;
        prevLastBlockHeight = lastBlockHeight;
        lastBlockHeight = height;
        const blockKey = makeBlockKey(
          height.toString(),
          new Date(timestamp / 1_000_000).toISOString()
        );
        let localVaasByBlock: VaasByBlock = {};
        localVaasByBlock[blockKey] = [];

        const chunks = [];
        this.logger.debug('attempting to fetch chunks');
        for (const chunk of blocks[i].chunks) {
          chunks.push(await provider.chunk(chunk.chunk_hash));
        }

        const transactions = chunks.flatMap(({ transactions }) => transactions);
        const coreBridge = contracts.coreBridge.get(network, 'Near');
        if (!coreBridge) {
          throw new Error('Unable to get contract address for Near');
        }
        this.logger.debug(`attempting to fetch ${transactions.length} transactions`);
        const totTx = transactions.length;
        let txCount = 1;
        for (const tx of transactions) {
          this.logger.debug(`fetching transaction ${txCount}/${totTx}`);
          txCount++;
          const outcome = await provider.txStatus(tx.hash, coreBridge);
          const logs = outcome.receipts_outcome
            .filter(
              ({ outcome }) =>
                (outcome as any).executor_id === coreBridge &&
                (outcome.status as ExecutionStatus).SuccessValue
            )
            .flatMap(({ outcome }) => outcome.logs)
            .filter((log) => log.startsWith('EVENT_JSON:')) // https://nomicon.io/Standards/EventsFormat
            .map((log) => JSON.parse(log.slice(11)) as EventLog)
            .filter(isWormholePublishEventLog);
          for (const log of logs) {
            const vaaKey = makeVaaKey(tx.hash, 'Near', log.emitter, log.seq.toString());
            localVaasByBlock[blockKey] = [...localVaasByBlock[blockKey], vaaKey];
          }
        }
        this.logger.debug(
          `Fetched ${localVaasByBlock[blockKey].length} messages from block ${blockKey}`
        );
        vaasByBlock[blockKey] = localVaasByBlock[blockKey];
        if (Date.now() >= quittingTime) {
          this.logger.warn(`Quitting early due to time constraint.`);
          break;
        }
      }
    } catch (e) {
      this.logger.error(`Near block getMessagesFromBlockResultsConstrained error: ${e}`);
      this.logger.warn(`Quitting early due to error.`);
      lastBlockHeight = prevLastBlockHeight;
    }

    const numMessages = Object.values(vaasByBlock).flat().length;
    this.logger.debug(`Fetched ${numMessages} messages from ${blocks.length} blocks`);

    return { vaasByBlock, lastBlockHeight };
  }
}

type ConstrainedResponse = {
  vaasByBlock: VaasByBlock;
  lastBlockHeight: number;
};

type GetTransactionsByAccountIdResponse = {
  txns: NearTxn[];
};

export type NearTxn = {
  receipt_id: string; // "FvRXsCxiMnSWG9NML1XFaCUw3UYiqocGvNjjsmS9fE3K",
  predecessor_account_id: string; //"contract.portalbridge.near",
  receiver_account_id: string; //"contract.wormhole_crypto.near",
  transaction_hash: string; //"By1pofzm3h9oG9ADnp66MTFut2iWMyLWDYRuWhyJhHw9",
  included_in_block_hash: string; //"E9tC4GwT1dPumcS1JRV1evfTps2R2Fq9aaxb49FVoQUq",
  block_timestamp: string; //"1712335003062739270",
  block: {
    block_height: number; //116190465
  };
  actions: [
    {
      action: string; //"FUNCTION_CALL",
      method: string; //"publish_message"
    }
  ];
  actions_agg: {
    deposit: number; //1
  };
  outcomes: {
    status: boolean; //true
  };
  outcomes_agg: {
    transaction_fee: number; //2.3824666512144e+21
  };
};
