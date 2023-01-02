import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils';
import { AptosClient, Types } from 'aptos';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeVaaKey } from '../databases/utils';
import { Watcher } from './Watcher';

const APTOS_CORE_BRIDGE_ADDRESS = CONTRACTS.MAINNET.aptos.core;
const APTOS_EVENT_HANDLE = `${APTOS_CORE_BRIDGE_ADDRESS}::state::WormholeMessageHandle`;
const APTOS_FIELD_NAME = 'event';

/**
 * NOTE: The Aptos watcher differs from other watchers in that it uses the event sequence number to
 * fetch Wormhole messages and therefore also stores sequence numbers instead of block numbers.
 */
export class AptosWatcher extends Watcher {
  client: AptosClient;
  maximumBatchSize: number = 25;

  constructor() {
    super('aptos');
    this.client = new AptosClient(RPCS_BY_CHAIN[this.chain]!);
  }

  async getFinalizedBlockNumber(): Promise<number> {
    return Number(
      (
        await this.client.getEventsByEventHandle(
          APTOS_CORE_BRIDGE_ADDRESS,
          APTOS_EVENT_HANDLE,
          APTOS_FIELD_NAME,
          { limit: 1 }
        )
      )[0].sequence_number
    );
  }

  async getMessagesForBlocks(fromSequence: number, toSequence: number): Promise<VaasByBlock> {
    const limit = toSequence - fromSequence + 1;
    const events: AptosEvent[] = (await this.client.getEventsByEventHandle(
      APTOS_CORE_BRIDGE_ADDRESS,
      APTOS_EVENT_HANDLE,
      APTOS_FIELD_NAME,
      { start: fromSequence, limit }
    )) as AptosEvent[];
    const vaasByBlock: VaasByBlock = {};
    await Promise.all(
      events.map(async ({ data, sequence_number, version }) => {
        const [block, transaction] = await Promise.all([
          this.client.getBlockByVersion(Number(version)),
          this.client.getTransactionByVersion(Number(version)),
        ]);
        const timestamp = new Date(Number(block.block_timestamp) / 1000).toISOString();
        const blockKey = [block.block_height, timestamp, sequence_number].join('/'); // use custom block key for now so we can include sequence number
        const emitter = data.sender.padStart(64, '0');
        const vaaKey = makeVaaKey(transaction.hash, this.chain, emitter, data.sequence);
        vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] ?? []), vaaKey];
      })
    );
    return vaasByBlock;
  }
}

type AptosEvent = Omit<Types.Event, 'data'> & {
  version: string;
  data: {
    consistency_level: number;
    nonce: string;
    payload: string;
    sender: string;
    sequence: string;
    timestamp: string;
  };
};
