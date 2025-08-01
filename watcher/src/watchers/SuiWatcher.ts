import { SuiClient } from '@mysten/sui/client';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { Watcher } from './Watcher';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Network } from '@wormhole-foundation/sdk-base';

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
  client: SuiClient;
  maximumBatchSize: number = 100000; // arbitrarily large as this pages back by events

  constructor(network: Network) {
    super(network, 'Sui', 'vaa');
    this.client = new SuiClient({ url: RPCS_BY_CHAIN[this.network][this.chain]! });
  }

  // TODO: this might break using numbers, the whole service needs a refactor to use BigInt
  async getFinalizedBlockNumber(): Promise<number> {
    return Number(await this.client.getLatestCheckpointSequenceNumber());
  }

  // TODO: this might break using numbers, the whole service needs a refactor to use BigInt
  async getMessagesForBlocks(
    fromCheckpoint: number,
    toCheckpoint: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    this.logger.info(`fetching info for checkpoints ${fromCheckpoint} to ${toCheckpoint}`);
    const vaasByBlock: VaasByBlock = {};

    {
      // reserve empty slot for initial block so query is cataloged
      const fromCheckpointTimestamp = new Date(
        Number((await this.client.getCheckpoint({ id: fromCheckpoint.toString() })).timestampMs)
      ).toISOString();
      const fromBlockKey = makeBlockKey(fromCheckpoint.toString(), fromCheckpointTimestamp);
      vaasByBlock[fromBlockKey] = [];
    }

    let lastCheckpoint: null | number = null;
    let cursor: any = undefined;
    let hasNextPage = false;
    do {
      const response = await this.client.queryEvents({
        query: { MoveEventType: SUI_EVENT_HANDLE },
        cursor,
        order: 'descending',
      });
      const digest = response.data.length
        ? response.data[response.data.length - 1].id.txDigest
        : null;
      lastCheckpoint = digest
        ? Number((await this.client.getTransactionBlock({ digest })).checkpoint!)
        : null;
      cursor = response.nextCursor;
      hasNextPage = response.hasNextPage;
      const digestArrayWithDups = response.data.map((e) => e.id.txDigest);
      const digestArray = Array.from(new Set(digestArrayWithDups));
      const txBlocks = await this.client.multiGetTransactionBlocks({
        digests: digestArray,
      });
      const checkpointByTxDigest = txBlocks.reduce<Record<string, string | undefined>>(
        (value, { digest, checkpoint }) => {
          value[digest] = checkpoint || undefined;
          return value;
        },
        {}
      );
      for (const event of response.data) {
        const checkpoint = checkpointByTxDigest[event.id.txDigest];
        if (!checkpoint) continue;
        const checkpointNum = Number(checkpoint);
        if (checkpointNum < fromCheckpoint || checkpointNum > toCheckpoint) continue;
        const msg = event.parsedJson as PublishMessageEvent;
        const timestamp = new Date(Number(msg.timestamp) * 1000).toISOString();
        const vaaKey = makeVaaKey(event.id.txDigest, 'Sui', msg.sender.slice(2), msg.sequence);
        const blockKey = makeBlockKey(checkpoint, timestamp);
        vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
      }
    } while (hasNextPage && lastCheckpoint && fromCheckpoint < lastCheckpoint);
    return { vaasByBlock };
  }
}
