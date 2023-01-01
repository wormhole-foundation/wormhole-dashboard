import { Implementation__factory } from '@certusone/wormhole-sdk/lib/cjs/ethers-contracts/factories/Implementation__factory';
import { CONTRACTS, EVMChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Log } from '@ethersproject/abstract-provider';
import axios from 'axios';
import { BigNumber } from 'ethers';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Watcher } from './Watcher';

// This is the hash for topic[0] of the core contract event LogMessagePublished
// https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/Implementation.sol#L12
export const LOG_MESSAGE_PUBLISHED_TOPIC =
  '0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2';
export const wormholeInterface = Implementation__factory.createInterface();

export type BlockTag = 'finalized' | 'safe' | 'latest';
export type Block = {
  hash: string;
  number: number;
  timestamp: number;
};

export class EVMWatcher extends Watcher {
  finalizedBlockTag: BlockTag;

  constructor(chain: EVMChainName, finalizedBlockTag: BlockTag = 'latest') {
    super(chain);
    this.finalizedBlockTag = finalizedBlockTag;
    if (chain === 'acala' || chain === 'karura') {
      this.maximumBatchSize = 50;
    }
  }

  async getBlock(blockNumberOrTag: number | BlockTag): Promise<Block> {
    const rpc = RPCS_BY_CHAIN[this.chain];
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
    )?.data?.[0]?.result;
    if (result && result.hash && result.number && result.timestamp) {
      // Convert to Ethers compatible type
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
  async getBlocks(fromBlock: number, toBlock: number): Promise<Block[]> {
    const rpc = RPCS_BY_CHAIN[this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    const reqs = [];
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      reqs.push({
        jsonrpc: '2.0',
        id: (blockNumber - fromBlock).toString(),
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, false],
      });
    }
    const results = (await axios.post(rpc, reqs, AXIOS_CONFIG_JSON))?.data;
    if (results && results.length) {
      // Convert to Ethers compatible type
      return results.map((response: undefined | { result?: Block }, idx: number) => {
        if (
          response?.result &&
          response.result.hash &&
          response.result.number &&
          response.result.timestamp
        ) {
          return {
            hash: response.result.hash,
            number: BigNumber.from(response.result.number).toNumber(),
            timestamp: BigNumber.from(response.result.timestamp).toNumber(),
          };
        }
        throw new Error(
          `Unable to parse result of eth_getBlockByNumber for ${fromBlock + idx} on ${rpc}`
        );
      });
    }
    throw new Error(
      `Unable to parse result of eth_getBlockByNumber for range ${fromBlock}-${toBlock} on ${rpc}`
    );
  }
  async getLogs(
    fromBlock: number,
    toBlock: number,
    address: string,
    topics: string[]
  ): Promise<Array<Log>> {
    const rpc = RPCS_BY_CHAIN[this.chain];
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
  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching block ${this.finalizedBlockTag}`);
    const block = await this.getBlock(this.finalizedBlockTag);
    return block.number;
  }
  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    const address = CONTRACTS.MAINNET[this.chain].core;
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    const logs = await this.getLogs(fromBlock, toBlock, address, [LOG_MESSAGE_PUBLISHED_TOPIC]);
    const timestampsByBlock: { [block: number]: string } = {};
    // fetch timestamps for each block
    const vaasByBlock: VaasByBlock = {};
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);
    const blocks = await this.getBlocks(fromBlock, toBlock);
    for (const block of blocks) {
      const timestamp = new Date(block.timestamp * 1000).toISOString();
      timestampsByBlock[block.number] = timestamp;
      vaasByBlock[makeBlockKey(block.number.toString(), timestamp)] = [];
    }
    this.logger.info(`processing ${logs.length} logs`);
    for (const log of logs) {
      const blockNumber = log.blockNumber;
      const emitter = log.topics[1].slice(2);
      const {
        args: { sequence },
      } = wormholeInterface.parseLog(log);
      const vaaKey = makeVaaKey(log.transactionHash, this.chain, emitter, sequence.toString());
      const blockKey = makeBlockKey(blockNumber.toString(), timestampsByBlock[blockNumber]);
      vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
    }
    return vaasByBlock;
  }
}
