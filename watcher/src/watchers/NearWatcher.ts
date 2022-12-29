// npx pretty-quick

import axios from 'axios';
import { connect } from 'near-api-js';
import { Provider } from 'near-api-js/lib/providers';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { Watcher } from './Watcher';

const NEAR_RPC = RPCS_BY_CHAIN.near!;
const NEAR_CONTRACT = 'contract.wormhole_crypto.near';
const AXIOS_CONFIG = {
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
};

export class NearWatcher extends Watcher {
  private provider: Provider | null = null;

  constructor() {
    super('near');
  }

  public async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);
    const provider = await this.getProvider();
    const block = await provider.block({ finality: 'final' });
    return block.header.height;
  }

  public async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    let vaasByBlock: VaasByBlock = {};
    let blockPromises = [];
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);

    //    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
    //      blockPromises.push(this.algodClient.block(blockNumber).do());
    //    }
    //
    //    const blocks = await Promise.all(blockPromises);
    //    this.processBlocks(blocks, vaasByBlock);

    return vaasByBlock;
  }

  async getProvider(): Promise<Provider> {
    if (!this.provider) {
      const connection = await connect({
        nodeUrl: NEAR_RPC,
        networkId: 'mainnet',
      });
      this.provider = connection.connection.provider;
    }
    return this.provider;
  }

  async getBlock(block: number): Promise<any> {
    let b = await axios.post(
      NEAR_RPC,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          block_id: block,
        },
      },
      AXIOS_CONFIG
    );

    return b.data;
  }

  async getBlockHash(block: string): Promise<any> {
    let b = await axios.post(
      NEAR_RPC,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          block_id: block,
        },
      },
      AXIOS_CONFIG
    );

    return b.data;
  }

  async getFinalBlock(): Promise<any> {
    let b = await axios.post(
      NEAR_RPC,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          finality: 'final',
        },
      },
      AXIOS_CONFIG
    );

    return b.data;
  }

  async getChunk(chunk_id: string): Promise<any> {
    let b = await axios.post(
      NEAR_RPC,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'chunk',
        params: {
          chunk_id: chunk_id,
        },
      },
      AXIOS_CONFIG
    );

    return b.data;
  }

  async getTxStatusWithReceipts(tx_hash: string, sender_account_id: string): Promise<any> {
    let b = await axios.post(
      NEAR_RPC,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'EXPERIMENTAL_tx_status',
        params: [tx_hash, sender_account_id],
      },
      AXIOS_CONFIG
    );

    return b.data;
  }

  async test_watcher() {
    const provider = await this.getProvider();
    // console.log(await this.getFinalizedBlockNumber());
  }
}

let a = new NearWatcher();
a.test_watcher();
