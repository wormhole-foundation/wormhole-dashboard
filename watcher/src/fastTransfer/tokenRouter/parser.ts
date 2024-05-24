import { ethers } from 'ethers';
import {
  EvmTokenRouter,
  LiquidityLayerTransactionResult,
} from '@wormhole-foundation/example-liquidity-layer-evm';
import {
  Chain,
  Network,
  chainToChainId,
  contracts,
  toChainId,
} from '@wormhole-foundation/sdk-base';
import { FAST_TRANSFER_CONTRACTS, FTChains } from '../consts';
import isNotNull from '../../../src/utils/isNotNull';
import { MarketOrder } from '../types';

class TokenRouterParser {
  private provider: ethers.providers.JsonRpcProvider;
  private evmTokenRouter: EvmTokenRouter;
  private network: Network;
  private chain: Chain;
  // the only 2 functions we care about
  private functionSelectors = [
    ethers.utils
      .id('placeFastMarketOrder(uint64,uint64,uint16,bytes32,bytes,address,uint64,uint32)')
      .substring(0, 10),
    ethers.utils
      .id('placeFastMarketOrder(uint64,uint16,bytes32,bytes,uint64,uint32)')
      .substring(0, 10),
  ];

  constructor(network: Network, chain: FTChains, provider: ethers.providers.JsonRpcProvider) {
    this.provider = provider;
    this.evmTokenRouter = new EvmTokenRouter(
      this.provider,
      FAST_TRANSFER_CONTRACTS[network]?.[chain]?.TokenRouter!,
      FAST_TRANSFER_CONTRACTS[network]?.[chain]?.CircleBridge!
    );
    this.network = network;
    this.chain = chain;
  }

  async parseFastMarketOrder(txHash: string): Promise<LiquidityLayerTransactionResult | null> {
    const txData = await this.provider.getTransaction(txHash);
    const input = txData.data;
    const selectorFromTx = input.slice(0, 10);

    // filtering only fast market orders
    const isPlaceFastMarketOrder = this.functionSelectors.includes(selectorFromTx);
    if (!isPlaceFastMarketOrder) return null;

    return this.evmTokenRouter.getTransactionResults(txHash);
  }

  async getFTResultsInRange(
    fromBlock: number,
    toBlock: number
  ): Promise<{
    results: MarketOrder[];
    lastBlockTime: number;
  }> {
    const filter = {
      // we need to look at core bridge emitted logs because token router publishes
      // slow and fast market orders through wormhole
      address: contracts.coreBridge.get(this.network, this.chain),
      fromBlock: fromBlock,
      toBlock: toBlock,
    };
    const logs = await this.provider.getLogs(filter);

    const txs = logs.map((log) => {
      return {
        hash: log.transactionHash,
        // caching blockNumber for block timestamp reference later
        blockNumber: log.blockNumber,
      };
    });

    // deduplicate since there could be both slow and fast order logs in the same tx
    const uniqueTxs = Array.from(new Map(txs.map((tx) => [tx.hash, tx])).values());
    const results = await Promise.all(
      uniqueTxs.map(async (tx) => {
        return {
          txResult: await this.parseFastMarketOrder(tx.hash),
          txHash: tx.hash,
          blockNumber: tx.blockNumber,
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

        const vaaId = `${toChainId(this.chain)}/${Buffer.from(fastMessage.emitterAddress).toString(
          'hex'
        )}/${fastMessage.sequence}`;

        const blockTime = await this.fetchBlockTime(blocks, res.blockNumber);

        return {
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
      })
    );

    const lastBlockTime = await this.fetchBlockTime(blocks, toBlock);

    return {
      results: ftResults.filter(isNotNull),
      lastBlockTime,
    };
  }

  private async fetchBlockTime(
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
}

export default TokenRouterParser;
