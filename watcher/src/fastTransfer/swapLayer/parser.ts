import { ethers } from 'ethers';
import { TransferCompletion } from '../types';
import { parseVaa } from '@wormhole-foundation/wormhole-monitor-common';
import { Knex } from 'knex';
import { Chain, chainToChainId } from '@wormhole-foundation/sdk-base';
import { TokenInfoManager } from '../../utils/TokenInfoManager';

class SwapLayerParser {
  private provider: ethers.providers.JsonRpcProvider;
  private swapLayerAddress: string;
  private swapLayerInterface: ethers.utils.Interface;
  private tokenInfoManager: TokenInfoManager | null = null;

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    swapLayerAddress: string,
    db: Knex | null,
    chain: Chain
  ) {
    this.provider = provider;
    this.swapLayerAddress = swapLayerAddress;
    this.swapLayerInterface = new ethers.utils.Interface([
      'event Redeemed(address indexed recipient, address outputToken, uint256 outputAmount, uint256 relayingFee)',
    ]);

    if (db) {
      this.tokenInfoManager = new TokenInfoManager(db, chainToChainId(chain), provider);
    }
  }

  async parseSwapLayerTransaction(
    txHash: string,
    blockTime: number
  ): Promise<TransferCompletion | null> {
    const receipt = await this.provider.getTransactionReceipt(txHash);

    const tx = await this.provider.getTransaction(txHash);
    if (!receipt || !tx) return null;

    // Remove the function selector (first 4 bytes)
    const inputData = '0x' + tx.data.slice(10);

    // Use AbiCoder to decode the raw input data
    let fillVaaId: string = '';
    const abiCoder = new ethers.utils.AbiCoder();
    try {
      const decodedInput = abiCoder.decode(['bytes', 'tuple(bytes, bytes, bytes)'], inputData);

      const encodedWormholeMessage = decodedInput[1][0];
      if (encodedWormholeMessage && encodedWormholeMessage.length >= 8) {
        const vaaBytes = Buffer.from(encodedWormholeMessage.slice(2), 'hex'); // Remove leading '0x'
        const parsedVaa = parseVaa(vaaBytes);

        fillVaaId = `${parsedVaa.emitterChain}/${parsedVaa.emitterAddress.toString('hex')}/${
          parsedVaa.sequence
        }`;
      }
    } catch (error) {
      console.error('Error decoding input data:', error);
    }

    const swapEvent = receipt.logs
      .filter((log) => log.address.toLowerCase() === this.swapLayerAddress.toLowerCase())
      .map((log) => {
        try {
          return this.swapLayerInterface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((event) => event && event.name === 'Redeemed');

    if (!swapEvent) return null;

    // if we have the tokenInfoManager inited, persist the token info
    // this ensures we have the token decimal and name for analytics purposes
    if (this.tokenInfoManager)
      await this.tokenInfoManager.saveTokenInfoIfNotExist(swapEvent.args.outputToken);

    return {
      tx_hash: txHash,
      recipient: swapEvent.args.recipient,
      output_amount: BigInt(swapEvent.args.outputAmount.toString()),
      output_token: swapEvent.args.outputToken,
      redeem_time: new Date(blockTime * 1000),
      relaying_fee: BigInt(swapEvent.args.relayingFee.toString()),
      fill_id: fillVaaId,
    };
  }

  async getFTSwapInRange(fromBlock: number, toBlock: number): Promise<TransferCompletion[]> {
    const filter = {
      address: this.swapLayerAddress,
      fromBlock,
      toBlock,
      topics: [this.swapLayerInterface.getEventTopic('Redeemed')],
    };

    const logs = await this.provider.getLogs(filter);

    const blocks: Map<number, ethers.providers.Block> = new Map();

    const results = await Promise.all(
      logs.map(async (log) => {
        const blockTime = await this.fetchBlockTime(blocks, log.blockNumber);
        const txHash = log.transactionHash;
        return this.parseSwapLayerTransaction(txHash, blockTime);
      })
    );

    return results.filter((result): result is TransferCompletion => result !== null);
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

export default SwapLayerParser;
