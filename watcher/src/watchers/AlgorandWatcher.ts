import algosdk from 'algosdk';
import { Watcher } from './Watcher';
import { ALGORAND_INFO } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Network } from '@wormhole-foundation/sdk-base';

type Message = {
  blockKey: string;
  vaaKey: string;
};

export class AlgorandWatcher extends Watcher {
  // Arbitrarily large since the code here is capable of pulling all logs from all via indexer pagination
  maximumBatchSize: number = 100000;

  algodClient: algosdk.Algodv2;
  indexerClient: algosdk.Indexer;

  constructor(network: Network) {
    super(network, 'Algorand', 'vaa');

    if (!ALGORAND_INFO[this.network].algodServer) {
      throw new Error('ALGORAND_INFO.algodServer is not defined!');
    }

    this.algodClient = new algosdk.Algodv2(
      ALGORAND_INFO[this.network].algodToken,
      ALGORAND_INFO[this.network].algodServer,
      ALGORAND_INFO[this.network].algodPort
    );
    this.indexerClient = new algosdk.Indexer(
      ALGORAND_INFO[this.network].token,
      ALGORAND_INFO[this.network].server,
      ALGORAND_INFO[this.network].port
    );
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);

    let status = await this.algodClient.status().do();
    return status['last-round'];
  }

  async getApplicationLogTransactionIds(fromBlock: number, toBlock: number): Promise<string[]> {
    // it is possible tihs may result in gaps if toBlock > response['current-round']
    // perhaps to avoid this, getFinalizedBlockNumber could use the indexer?
    let transactionIds: string[] = [];
    let nextToken: string | undefined;
    let numResults: number | undefined;
    const maxResults = 225; // determined through testing
    do {
      const request = this.indexerClient
        .lookupApplicationLogs(ALGORAND_INFO[this.network].appid)
        .minRound(fromBlock)
        .maxRound(toBlock);
      if (nextToken) {
        request.nextToken(nextToken);
      }
      const response = await request.do();
      transactionIds = [
        ...transactionIds,
        ...(response?.['log-data']?.map((l: any) => l.txid) || []),
      ];
      nextToken = response?.['next-token'];
      numResults = response?.['log-data']?.length;
    } while (nextToken && numResults && numResults >= maxResults);
    return transactionIds;
  }

  processTransaction(transaction: any, parentId?: string): Message[] {
    let messages: Message[] = [];
    if (
      transaction['tx-type'] !== 'pay' &&
      transaction['application-transaction']?.['application-id'] ===
        ALGORAND_INFO[this.network].appid &&
      transaction.logs?.length === 1
    ) {
      messages.push({
        blockKey: makeBlockKey(
          transaction['confirmed-round'].toString(),
          new Date(transaction['round-time'] * 1000).toISOString()
        ),
        vaaKey: makeVaaKey(
          parentId || transaction.id,
          this.chain,
          Buffer.from(algosdk.decodeAddress(transaction.sender).publicKey).toString('hex'),
          BigInt(`0x${Buffer.from(transaction.logs[0], 'base64').toString('hex')}`).toString()
        ),
      });
    }
    if (transaction['inner-txns']) {
      for (const innerTransaction of transaction['inner-txns']) {
        messages = [...messages, ...this.processTransaction(innerTransaction, transaction.id)];
      }
    }
    return messages;
  }

  async getMessagesForBlocks(
    fromBlock: number,
    toBlock: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    const txIds = await this.getApplicationLogTransactionIds(fromBlock, toBlock);
    const transactions = [];
    for (const txId of txIds) {
      const response = await this.indexerClient.searchForTransactions().txid(txId).do();
      if (response?.transactions?.[0]) {
        transactions.push(response.transactions[0]);
      }
    }
    let messages: Message[] = [];
    for (const transaction of transactions) {
      messages = [...messages, ...this.processTransaction(transaction)];
    }
    const vaasByBlock = messages.reduce((vaasByBlock, message) => {
      if (!vaasByBlock[message.blockKey]) {
        vaasByBlock[message.blockKey] = [];
      }
      vaasByBlock[message.blockKey].push(message.vaaKey);
      return vaasByBlock;
    }, {} as VaasByBlock);
    const toBlockInfo = await this.indexerClient.lookupBlock(toBlock).do();
    const toBlockTimestamp = new Date(toBlockInfo.timestamp * 1000).toISOString();
    const toBlockKey = makeBlockKey(toBlock.toString(), toBlockTimestamp);
    if (!vaasByBlock[toBlockKey]) {
      vaasByBlock[toBlockKey] = [];
    }
    return { vaasByBlock };
  }
}
