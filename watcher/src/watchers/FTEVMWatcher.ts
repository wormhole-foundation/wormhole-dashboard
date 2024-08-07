import knex, { Knex } from 'knex';
import { Watcher } from './Watcher';
import { Network } from '@wormhole-foundation/sdk-base';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { FAST_TRANSFER_CONTRACTS, FTChains } from '../fastTransfer/consts';
import { ethers } from 'ethers';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { makeBlockKey } from '../databases/utils';
import TokenRouterParser from '../fastTransfer/tokenRouter/parser';
import SwapLayerParser from '../fastTransfer/swapLayer/parser';
import { Block } from './EVMWatcher';
import { BigNumber } from 'ethers';
import axios from 'axios';
import { sleep } from '@wormhole-foundation/wormhole-monitor-common';

export type BlockTag = 'finalized' | 'safe' | 'latest';

export class FTEVMWatcher extends Watcher {
  finalizedBlockTag: BlockTag;
  lastTimestamp: number;
  latestFinalizedBlockNumber: number;
  tokenRouterAddress: string;
  swapLayerAddress: string | undefined;
  rpc: string;
  provider: ethers.providers.JsonRpcProvider;
  tokenRouterParser: TokenRouterParser;
  swapLayerParser: SwapLayerParser | null;
  pg: Knex | null = null;

  constructor(
    network: Network,
    chain: FTChains,
    finalizedBlockTag: BlockTag = 'latest',
    isTest = false
  ) {
    super(network, chain, 'ft');
    this.lastTimestamp = 0;
    this.latestFinalizedBlockNumber = 0;
    this.finalizedBlockTag = finalizedBlockTag;
    this.tokenRouterAddress = FAST_TRANSFER_CONTRACTS[network]?.[chain]?.TokenRouter!;
    this.swapLayerAddress = FAST_TRANSFER_CONTRACTS[network]?.[chain]?.SwapLayer;
    this.provider = new ethers.providers.JsonRpcProvider(RPCS_BY_CHAIN[network][chain]);
    this.rpc = RPCS_BY_CHAIN[this.network][this.chain]!;
    this.tokenRouterParser = new TokenRouterParser(this.network, chain, this.provider);
    this.swapLayerParser = this.swapLayerAddress
      ? new SwapLayerParser(this.provider, this.swapLayerAddress)
      : null;
    this.logger.debug('FTWatcher', network, chain, finalizedBlockTag);
    // hacky way to not connect to the db in tests
    // this is to allow ci to run without a db
    if (isTest) {
      // Components needed for testing is complete
      return;
    }

    this.pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_FT_USER'),
        password: assertEnvironmentVariable('PG_FT_PASSWORD'),
        database: assertEnvironmentVariable('PG_FT_DATABASE'),
        host: assertEnvironmentVariable('PG_FT_HOST'),
        port: Number(assertEnvironmentVariable('PG_FT_PORT')),
      },
    });
  }

  async getBlock(blockNumberOrTag: number | BlockTag): Promise<Block> {
    const rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    let result = (
      await axios.post(
        rpc,
        [
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByNumber',
            params: [
              typeof blockNumberOrTag === 'number'
                ? `0x${blockNumberOrTag.toString(16)}`
                : blockNumberOrTag,
              false,
            ],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data?.[0];
    if (result && result.result === null) {
      // Found null block
      if (
        typeof blockNumberOrTag === 'number' &&
        blockNumberOrTag < this.latestFinalizedBlockNumber - 1000
      ) {
        return {
          hash: '',
          number: BigNumber.from(blockNumberOrTag).toNumber(),
          timestamp: BigNumber.from(this.lastTimestamp).toNumber(),
        };
      }
    } else if (result && result.error && result.error.code === 6969) {
      return {
        hash: '',
        number: BigNumber.from(blockNumberOrTag).toNumber(),
        timestamp: BigNumber.from(this.lastTimestamp).toNumber(),
      };
    }
    result = result?.result;
    if (result && result.hash && result.number && result.timestamp) {
      // Convert to Ethers compatible type
      this.lastTimestamp = result.timestamp;
      return {
        hash: result.hash,
        number: BigNumber.from(result.number).toNumber(),
        timestamp: BigNumber.from(result.timestamp).toNumber(),
      };
    }
    throw new Error(
      `Unable to parse result of eth_getBlockByNumber for ${blockNumberOrTag} on ${rpc}`
    );
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching block ${this.finalizedBlockTag}`);
    const block: Block = await this.getBlock(this.finalizedBlockTag);
    this.latestFinalizedBlockNumber = block.number;
    return block.number;
  }

  async getFtMessagesForBlocks(fromBlock: number, toBlock: number): Promise<string> {
    const tokenRouterPromise = this.tokenRouterParser.getFTResultsInRange(fromBlock, toBlock);
    const swapLayerPromise = this.swapLayerParser?.getFTSwapInRange(fromBlock, toBlock) || [];

    const [tokenRouterResults, swapLayerResults] = await Promise.all([
      tokenRouterPromise,
      swapLayerPromise,
    ]);

    if (tokenRouterResults.results.length) {
      await this.saveBatch(
        tokenRouterResults.results,
        'market_orders',
        'fast_vaa_id',
        fromBlock,
        toBlock
      );
    }

    if (swapLayerResults.length) {
      await this.saveBatch(swapLayerResults, 'redeem_swaps', 'fill_id', fromBlock, toBlock);
    }

    // we do not need to compare the lastBlockTime from tokenRouter and swapLayer as they both use toBlock
    const lastBlockTime = tokenRouterResults.lastBlockTime;
    return makeBlockKey(toBlock.toString(), lastBlockTime.toString());
  }

  // saves items in smaller batches to reduce the impact in any case anything fails
  // retry with exponential backoff is used here
  private async saveBatch<T>(
    items: T[],
    tableName: string,
    conflictColumn: string,
    fromBlock?: number,
    toBlock?: number
  ): Promise<void> {
    if (!this.pg) {
      return;
    }

    const batchSize = 50;
    const maxRetries = 3;
    const totalBatches = Math.ceil(items.length / batchSize);

    this.logger.debug(`Attempting to save ${items.length} ${tableName} in batches of ${batchSize}`);

    for (let batchIndex = 0; batchIndex < items.length; batchIndex += batchSize) {
      const batch = items.slice(batchIndex, batchIndex + batchSize);
      const batchNumber = Math.floor(batchIndex / batchSize) + 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.pg(tableName).insert(batch).onConflict(conflictColumn).merge();
          this.logger.info(
            `Successfully saved batch ${batchNumber}/${totalBatches} (${batch.length} ${tableName})`
          );
          break;
        } catch (e) {
          if (attempt === maxRetries) {
            const errorMessage = `Failed to save batch ${batchNumber}/${totalBatches} of ${tableName} after ${maxRetries} attempts`;
            this.logger.error(
              fromBlock && toBlock
                ? `${errorMessage} from block ${fromBlock} - ${toBlock}`
                : errorMessage,
              e
            );
          } else {
            this.logger.warn(
              `Attempt ${attempt} failed for batch ${batchNumber}/${totalBatches} of ${tableName}. Retrying...`
            );
            await sleep(1000 * Math.pow(2, attempt - 1));
          }
        }
      }
    }
    this.logger.info(
      `Completed saving ${items.length} ${tableName} from ${fromBlock} to ${toBlock}`
    );
  }
}

export default FTEVMWatcher;
