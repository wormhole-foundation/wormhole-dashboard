// npx pretty-quick

import { ChainName } from '@certusone/wormhole-sdk';
import { BigNumber } from 'ethers';

import { Watcher } from './Watcher';

import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { VaasByBlock } from '../databases/types';

import axios from 'axios';

export class NearWatcher extends Watcher {
  nearNodeUrl: string = 'https://rpc.mainnet.near.org';
  networkId: string = 'mainnet';
  contract: string = 'contract.wormhole_crypto.near';
  axiosConfig = {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
    },
  };

  constructor(chain: ChainName, mainnet: boolean) {
    super(chain);
  }

  async getBlock(block: number): Promise<any> {
    let b = await axios.post(
      this.nearNodeUrl,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          block_id: block,
        },
      },
      this.axiosConfig
    );

    return b.data;
  }

  async getBlockHash(block: string): Promise<any> {
    let b = await axios.post(
      this.nearNodeUrl,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          block_id: block,
        },
      },
      this.axiosConfig
    );

    return b.data;
  }

  async getFinalBlock(): Promise<any> {
    let b = await axios.post(
      this.nearNodeUrl,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'block',
        params: {
          finality: 'final',
        },
      },
      this.axiosConfig
    );

    return b.data;
  }

  async getChunk(chunk_id: string): Promise<any> {
    let b = await axios.post(
      this.nearNodeUrl,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'chunk',
        params: {
          chunk_id: chunk_id,
        },
      },
      this.axiosConfig
    );

    return b.data;
  }

  async getTxStatusWithReceipts(tx_hash: string, sender_account_id: string): Promise<any> {
    let b = await axios.post(
      this.nearNodeUrl,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'EXPERIMENTAL_tx_status',
        params: [tx_hash, sender_account_id],
      },
      this.axiosConfig
    );

    return b.data;
  }

  async getFinalizedBlockNumber(): Promise<number | null> {
    this.logger.info(`fetching final block for ${this.chain}`);

    let b = await this.getFinalBlock();

    return b.result.header.height;
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
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

  async test_watcher() {
      console.log(await this.getMessagesForBlocks(80553210, 80553210));
      //console.log(await this.getFinalizedBlockNumber());
      //console.log(await this.getBlock(81153529));
  }
}

let a = new NearWatcher('near', true);
a.test_watcher();
