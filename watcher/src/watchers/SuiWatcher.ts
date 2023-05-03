import { CHAIN_ID_SUI } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  Checkpoint,
  JsonRpcClient,
  PaginatedEvents,
  SuiTransactionBlockResponse,
} from '@mysten/sui.js';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { Watcher } from './Watcher';
import { makeBlockKey, makeVaaKey } from '../databases/utils';

const SUI_EVENT_HANDLE = `0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a::publish_message::WormholeMessage`;

type PublishMessageEvent = {
  consistency_level: number;
  nonce: number;
  payload: number[];
  sender: string;
  sequence: string;
  timestamp: string;
};

export class SuiWatcher extends Watcher {
  client: JsonRpcClient;
  maximumBatchSize: number = 100000; // arbitrarily large as this pages back by events

  constructor() {
    super('sui');
    this.client = new JsonRpcClient(RPCS_BY_CHAIN[this.chain]!);
  }

  // TODO: this might break using numbers, the whole service needs a refactor to use BigInt
  async getFinalizedBlockNumber(): Promise<number> {
    return Number(
      (await this.client.request('sui_getLatestCheckpointSequenceNumber', undefined)).result
    );
  }

  // TODO: this might break using numbers, the whole service needs a refactor to use BigInt
  async getMessagesForBlocks(fromCheckpoint: number, toCheckpoint: number): Promise<VaasByBlock> {
    this.logger.info(`fetching info for checkpoints ${fromCheckpoint} to ${toCheckpoint}`);
    const vaasByBlock: VaasByBlock = {};

    {
      // reserve empty slot for initial block so query is cataloged
      const fromCheckpointTimestamp = new Date(
        Number(
          (
            await this.client.requestWithType(
              'sui_getCheckpoint',
              { id: fromCheckpoint.toString() },
              Checkpoint
            )
          ).timestampMs
        )
      ).toISOString();
      const fromBlockKey = makeBlockKey(fromCheckpoint.toString(), fromCheckpointTimestamp);
      vaasByBlock[fromBlockKey] = [];
    }

    let lastCheckpoint: null | number = null;
    let cursor: any = undefined;
    let hasNextPage = false;
    do {
      const response = await this.client.requestWithType(
        'suix_queryEvents',
        {
          query: { MoveEventType: SUI_EVENT_HANDLE },
          cursor,
          descending_order: true,
        },
        PaginatedEvents
      );
      const digest = response.data.length
        ? response.data[response.data.length - 1].id.txDigest
        : null;
      lastCheckpoint = digest
        ? Number(
            (
              await this.client.requestWithType(
                'sui_getTransactionBlock',
                { digest },
                SuiTransactionBlockResponse
              )
            ).checkpoint!
          )
        : null;
      cursor = response.nextCursor;
      hasNextPage = response.hasNextPage;
      for (const event of response.data) {
        // TODO: https://docs.sui.io/sui-jsonrpc#sui_multiGetTransactionBlocks
        const checkpoint = (
          await this.client.requestWithType(
            'sui_getTransactionBlock',
            { digest: event.id.txDigest },
            SuiTransactionBlockResponse
          )
        ).checkpoint!;
        const msg = event.parsedJson as PublishMessageEvent;
        const timestamp = new Date(Number(msg.timestamp) * 1000).toISOString();
        const vaaKey = makeVaaKey(
          event.id.txDigest,
          CHAIN_ID_SUI,
          msg.sender.slice(2),
          msg.sequence
        );
        const blockKey = makeBlockKey(checkpoint, timestamp);
        vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
      }
    } while (hasNextPage && lastCheckpoint && fromCheckpoint < lastCheckpoint);
    return vaasByBlock;
  }
}
