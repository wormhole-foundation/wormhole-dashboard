import knex, { Knex } from 'knex';
import { Watcher } from './Watcher';
import { chainToChainId, contracts, Network, toChainId } from '@wormhole-foundation/sdk-base';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { FAST_TRANSFER_CONTRACTS, FTEVMChain } from '../fastTransfer/consts';
import { ethers } from 'ethers';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { makeBlockKey } from '../databases/utils';
import { Block } from './EVMWatcher';
import { BigNumber } from 'ethers';
import axios from 'axios';
import { MarketOrder } from '../fastTransfer/types';
import { Log } from '@ethersproject/abstract-provider';
import { ethers_contracts } from '@wormhole-foundation/sdk-evm-core';
import {
  EvmTokenRouter,
  LiquidityLayerTransactionResult,
} from '@wormhole-foundation/example-liquidity-layer-evm';
import isNotNull from '../utils/isNotNull';

export type BlockTag = 'finalized' | 'safe' | 'latest';
export const LOG_MESSAGE_PUBLISHED_TOPIC =
  '0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2';
export const wormholeInterface = ethers_contracts.Implementation__factory.createInterface();

export class FTEVMWatcher extends Watcher {
  finalizedBlockTag: BlockTag;
  lastTimestamp: number;
  latestFinalizedBlockNumber: number;
  rpc: string;
  provider: ethers.providers.JsonRpcProvider;
  tokenRouterContract: string;
  evmTokenRouter: EvmTokenRouter;
  pg: Knex | null = null;

  constructor(
    network: Network,
    chain: FTEVMChain,
    finalizedBlockTag: BlockTag = 'latest',
    isTest = false
  ) {
    super(network, chain, 'ft');
    this.lastTimestamp = 0;
    this.latestFinalizedBlockNumber = 0;
    this.finalizedBlockTag = finalizedBlockTag;
    this.provider = new ethers.providers.JsonRpcProvider(RPCS_BY_CHAIN[network][chain]);
    this.rpc = RPCS_BY_CHAIN[network][chain]!;
    this.evmTokenRouter = new EvmTokenRouter(
      this.provider,
      FAST_TRANSFER_CONTRACTS[network]?.[chain]?.TokenRouter!,
      FAST_TRANSFER_CONTRACTS[network]?.[chain]?.CircleBridge!
    );
    const tokenRouterContract =
      FAST_TRANSFER_CONTRACTS[network]?.[chain]?.TokenRouter.toLowerCase();
    if (!tokenRouterContract) {
      throw new Error(`TokenRouter contract not defined for network ${network} and chain ${chain}`);
    }
    this.tokenRouterContract = this.normalizeAddress(tokenRouterContract);

    // Initialize database connection before creating swap layer parser
    if (!isTest) {
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

    this.logger.debug(`Initialized FTEVMWatcher for ${network} ${chain}`);
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
    const tokenRouterResults = await this.getFTResultsInRange(fromBlock, toBlock);
    this.logger.debug(`number of tokenRouterResults: ${tokenRouterResults.results.length}`);

    if (tokenRouterResults.results.length) {
      // call upsertMarketOrder for each market order
      for (const marketOrder of tokenRouterResults.results) {
        await this.upsertMarketOrder(marketOrder);
      }
    }

    const lastBlockTime = new Date(tokenRouterResults.lastBlockTime * 1000);
    return makeBlockKey(toBlock.toString(), lastBlockTime.toISOString());
  }

  private async upsertMarketOrder(marketOrder: MarketOrder) {
    if (!this.pg) {
      return;
    }
    // NOTE:  The status column in the DB is not updated by this code.
    //        If this is an insert, the status will be 'pending' by schema default.
    const existingOrder = await this.pg('market_orders')
      .where({ fast_vaa_id: marketOrder.fast_vaa_id })
      .first();

    if (existingOrder) {
      // Create an update object and do a manual merge.
      const updateData: MarketOrder = existingOrder;

      if (marketOrder.fast_vaa_hash && marketOrder.fast_vaa_hash !== existingOrder.fast_vaa_hash) {
        updateData.fast_vaa_hash = marketOrder.fast_vaa_hash;
      }
      if (
        marketOrder.amount_in &&
        marketOrder.amount_in > 0 &&
        marketOrder.amount_in !== existingOrder.amount_in
      ) {
        updateData.amount_in = marketOrder.amount_in;
      }
      if (
        marketOrder.min_amount_out &&
        marketOrder.min_amount_out > 0 &&
        marketOrder.min_amount_out !== existingOrder.min_amount_out
      ) {
        updateData.min_amount_out = marketOrder.min_amount_out;
      }
      if (
        marketOrder.src_chain &&
        marketOrder.src_chain > 0 &&
        marketOrder.src_chain !== existingOrder.src_chain
      ) {
        updateData.src_chain = marketOrder.src_chain;
      }
      if (
        marketOrder.dst_chain &&
        marketOrder.dst_chain > 0 &&
        marketOrder.dst_chain !== existingOrder.dst_chain
      ) {
        updateData.dst_chain = marketOrder.dst_chain;
      }
      if (marketOrder.sender && marketOrder.sender !== existingOrder.sender) {
        updateData.sender = marketOrder.sender;
      }
      if (marketOrder.redeemer && marketOrder.redeemer !== existingOrder.redeemer) {
        updateData.redeemer = marketOrder.redeemer;
      }
      if (
        marketOrder.market_order_tx_hash &&
        marketOrder.market_order_tx_hash !== existingOrder.market_order_tx_hash
      ) {
        updateData.market_order_tx_hash = marketOrder.market_order_tx_hash;
      }
      if (
        marketOrder.market_order_timestamp &&
        marketOrder.market_order_timestamp > existingOrder.market_order_timestamp
      ) {
        updateData.market_order_timestamp = marketOrder.market_order_timestamp;
      }

      this.logger.debug(`upsertMarketOrder: Updating market order ${updateData}`);
      await this.pg('market_orders')
        .where({ fast_vaa_id: marketOrder.fast_vaa_id })
        .update(updateData);
    } else {
      // Insert if it doesn't exist
      this.logger.debug(`upsertMarketOrder: Inserting market order ${marketOrder}`);
      await this.pg('market_orders').insert(marketOrder);
    }
  }

  async getFTResultsInRange(
    fromBlock: number,
    toBlock: number
  ): Promise<{
    results: MarketOrder[];
    lastBlockTime: number;
  }> {
    // we need to look at core bridge emitted logs because token router publishes
    // slow and fast market orders through wormhole
    const address = contracts.coreBridge.get(this.network, this.chain);
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    const logs = await this.getLogs(fromBlock, toBlock, address, [LOG_MESSAGE_PUBLISHED_TOPIC]);

    const results = await Promise.all(
      logs.map(async (log) => {
        const txResult = await this.parseFastMarketOrder(log);
        this.logger.debug(
          `Parsed log for tx: ${log.transactionHash}, block: ${
            log.blockNumber
          }, result: ${JSON.stringify(txResult, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )}`
        );
        return {
          txResult: txResult,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
      })
    );

    // simple caching for block info
    // we are limiting this block to this method scope instead of in the object
    // because we won't be looking at the same blocks after this method
    const blocks: Map<number, ethers.providers.Block> = new Map();
    const ftResults: (MarketOrder | null)[] = await Promise.all(
      results.map(async (res) => {
        if (!res || !res.txResult) return null;
        const fastMessage = res.txResult.fastMessage;
        if (!fastMessage) return null;
        const fastOrder = fastMessage.message.body.fastMarketOrder;
        if (!fastOrder) return null;
        this.logger.debug(
          `Processing fast market order: ${JSON.stringify(fastOrder, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )}`
        );

        const vaaId = `${toChainId(this.chain)}/${Buffer.from(fastMessage.emitterAddress).toString(
          'hex'
        )}/${fastMessage.sequence}`;

        const blockTime = await this.fetchBlockTime(blocks, res.blockNumber);

        const marketOrder: MarketOrder = {
          fast_vaa_id: vaaId,
          amount_in: fastOrder.amountIn,
          min_amount_out: fastOrder.minAmountOut,
          src_chain: chainToChainId(this.chain),
          dst_chain: toChainId(fastOrder.targetChain),
          sender: fastOrder.sender.toString('hex'),
          redeemer: fastOrder.redeemer.toString('hex'),
          market_order_tx_hash: res.txHash,
          market_order_timestamp: new Date(blockTime * 1000),
        };
        this.logger.debug(
          `Adding the following Market order to ftResults: ${JSON.stringify(
            marketOrder,
            (key, value) => (typeof value === 'bigint' ? value.toString() : value)
          )}`
        );
        return marketOrder;
      })
    );

    const lastBlockTime = await this.fetchBlockTime(blocks, toBlock);
    this.logger.debug(`FT results [${ftResults}]`);
    const nonNullFtResults = ftResults.filter(isNotNull);
    this.logger.debug(`FT results [${nonNullFtResults}]`);

    return {
      results: ftResults.filter(isNotNull),
      lastBlockTime,
    };
  }

  async parseFastMarketOrder(
    log: ethers.providers.Log
  ): Promise<LiquidityLayerTransactionResult | null> {
    // This is getting a core bridge emitted log.
    // It needs to see if the emitter address is the TokenRouter and the consistency level is 200 (instant finality).
    // If it isn't, it should return null.
    const txHash = log.transactionHash;
    this.logger.debug(`Parsing log for tx: ${txHash}, block: ${log.blockNumber}`);
    const emitterAddress = this.normalizeAddress(log.topics[1]);
    if (emitterAddress !== this.tokenRouterContract) {
      this.logger.debug(
        `Emitter address mismatch for tx: ${txHash}, block: ${log.blockNumber}, expected: ${this.tokenRouterContract}, got: ${emitterAddress}`
      );
      return null;
    }
    const retval = wormholeInterface.parseLog(log);
    if (
      !retval ||
      !retval.args ||
      !retval.args.consistencyLevel ||
      retval.args.consistencyLevel != 200
    ) {
      this.logger.debug(
        `Log tx: ${log.transactionHash}, block: ${log.blockNumber} is not a fast market order`
      );
      return null;
    }

    this.logger.debug(`Log tx: ${txHash}, block: ${log.blockNumber} IS a fast market order`);
    return this.evmTokenRouter.getTransactionResults(txHash);
  }

  async fetchBlockTime(
    blocks: Map<number, ethers.providers.Block>,
    blockNumber: number
  ): Promise<number> {
    let block = blocks.get(blockNumber);
    if (!block) {
      block = await this.provider.getBlock(blockNumber);
      blocks.set(blockNumber, block);
    }
    return block.timestamp;
  }

  async getLogs(
    fromBlock: number,
    toBlock: number,
    address: string,
    topics: string[]
  ): Promise<Array<Log>> {
    const rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    const result = (
      await axios.post(
        rpc,
        [
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getLogs',
            params: [
              {
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                address,
                topics,
              },
            ],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data?.[0]?.result;
    if (result) {
      // Convert to Ethers compatible type
      return result.map((l: Log) => ({
        ...l,
        blockNumber: BigNumber.from(l.blockNumber).toNumber(),
        transactionIndex: BigNumber.from(l.transactionIndex).toNumber(),
        logIndex: BigNumber.from(l.logIndex).toNumber(),
      }));
    }
    throw new Error(`Unable to parse result of eth_getLogs for ${fromBlock}-${toBlock} on ${rpc}`);
  }

  normalizeAddress(address: string): string {
    // If the address is already 66 characters long and starts with '0x', return it as is
    if (address.length === 66 && address.startsWith('0x')) {
      return address.toLowerCase();
    }

    // Remove '0x' prefix if present
    let stripped = address.toLowerCase().replace(/^0x/, '');

    // Pad with leading zeros to ensure 64 hex characters
    let padded = stripped.padStart(64, '0');

    // Return with '0x' prefix
    return '0x' + padded;
  }
}

export default FTEVMWatcher;
