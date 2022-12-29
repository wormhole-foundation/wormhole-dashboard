// npx pretty-quick

import { connect } from 'near-api-js';
import { Provider } from 'near-api-js/lib/providers';
import { ExecutionStatus } from 'near-api-js/lib/providers/provider';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Watcher } from './Watcher';

const NEAR_ARCHIVE_RPC = 'https://archival-rpc.mainnet.near.org';
const NEAR_RPC = RPCS_BY_CHAIN.near!;
const NEAR_CONTRACT = 'contract.wormhole_crypto.near';

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
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);
    const provider = await this.getProvider();
    const vaasByBlock: VaasByBlock = {};

    for (let blockId = fromBlock; blockId <= toBlock; blockId++) {
      const block = await provider.block({ blockId });
      const chunks = await Promise.all(
        block.chunks.map(({ chunk_hash }) => provider.chunk(chunk_hash))
      );
      const transactions = chunks.flatMap(({ transactions }) => transactions);
      for (const tx of transactions) {
        const outcome = await provider.txStatus(tx.hash, NEAR_CONTRACT);
        if (
          (outcome.status as ExecutionStatus).SuccessValue ||
          (outcome.status as ExecutionStatus).SuccessReceiptId
        ) {
          const logs = outcome.receipts_outcome
            .filter(({ outcome }) => (outcome as any).executor_id === NEAR_CONTRACT)
            .flatMap(({ outcome }) => outcome.logs)
            .filter((log) => log.startsWith('EVENT_JSON:')) // https://nomicon.io/Standards/EventsFormat
            .map((log) => JSON.parse(log.slice(11)) as EventLog)
            .filter(isWormholePublishEventLog);
          for (const log of logs) {
            const { height, timestamp } = block.header;
            const blockKey = makeBlockKey(height.toString(), timestamp.toString());
            const vaaKey = makeVaaKey(tx.hash, this.chain, log.emitter, log.seq.toString());
            vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
          }
        }
      }
    }

    return vaasByBlock;
  }

  async getProvider(): Promise<Provider> {
    if (!this.provider) {
      const connection = await connect({
        nodeUrl: NEAR_ARCHIVE_RPC,
        networkId: 'mainnet',
      });
      this.provider = connection.connection.provider;
    }
    return this.provider;
  }
}

// https://nomicon.io/Standards/EventsFormat
type EventLog = {
  event: string;
  standard: string;
  data?: unknown;
  version?: string; // this is supposed to exist but is missing in WH logs
} & Partial<WormholePublishEventLog>;

type WormholePublishEventLog = {
  standard: 'wormhole';
  event: 'publish';
  data: string;
  nonce: number;
  emitter: string;
  seq: number;
  block: number;
};

const isWormholePublishEventLog = (log: EventLog): log is WormholePublishEventLog => {
  return log.standard === 'wormhole' && log.event === 'publish';
};
