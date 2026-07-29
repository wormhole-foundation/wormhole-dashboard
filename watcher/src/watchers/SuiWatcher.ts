import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { SUI_GRAPHQL_URLS, SUI_GRPC_URLS } from '../consts.js';
import { VaasByBlock } from '../databases/types.js';
import { Watcher } from './Watcher.js';
import { makeBlockKey, makeVaaKey } from '../databases/utils.js';
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

type EventData<T = any> = {
  transaction: {
    digest: string;
  };
  contents: {
    json: T;
  };
};
type Pagination = {
  hasNextPage: boolean;
  endCursor: string;
};
type GraphQLFetchEventsResponse = {
  events: {
    nodes: EventData[];
    pageInfo: Pagination;
  };
};
type FetchEventsResponse<T = any> = {
  events: EventData<T>[];
  pagination: Pagination;
};
// The proto-generated gRPC types aren't publicly exported by @mysten/sui, so
// derive them from the SuiGrpcClient's own method return types rather than
// importing its internal dist paths (which its exports map hides).
type LedgerService = SuiGrpcClient['ledgerService'];
type Checkpoint = NonNullable<
  Awaited<ReturnType<LedgerService['getCheckpoint']>>['response']['checkpoint']
>;
type GetTransactionResult = Awaited<
  ReturnType<LedgerService['batchGetTransactions']>
>['response']['transactions'][number];
type SuccessfulGetTransactionResult = Extract<
  GetTransactionResult['result'],
  { oneofKind: 'transaction' }
>;
type ExecutedTransaction = SuccessfulGetTransactionResult['transaction'];

export class SuiWatcher extends Watcher {
  graphql: SuiGraphQLClient;
  client: SuiGrpcClient;
  maximumBatchSize: number = 100000; // arbitrarily large as this pages by events

  constructor(network: Network) {
    super(network, 'Sui', 'vaa');
    this.graphql = new SuiGraphQLClient({
      network: this.network,
      url: SUI_GRAPHQL_URLS[this.network],
    });
    this.client = new SuiGrpcClient({
      network: this.network,
      baseUrl: SUI_GRPC_URLS[this.network],
    });
  }

  // TODO: this might break using numbers, the whole service needs a refactor to use BigInt
  async getFinalizedBlockNumber(): Promise<number> {
    const { response: info } = await this.client.ledgerService.getServiceInfo({});
    if (!info.checkpointHeight) {
      throw new Error('Failed to retrieve last checkpoint height');
    }
    return Number(info.checkpointHeight);
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
      const checkpoint = await this.fetchCheckpoint(fromCheckpoint);
      const fromCheckpointTimestamp = new Date(
        Number(checkpoint.summary?.timestamp?.seconds) * 1000
      ).toISOString();
      const fromBlockKey = makeBlockKey(fromCheckpoint.toString(), fromCheckpointTimestamp);
      vaasByBlock[fromBlockKey] = [];
    }

    let cursor: string | undefined = undefined;
    let hasNextPage = false;
    do {
      const { events, pagination } = await this.fetchEvents(fromCheckpoint, toCheckpoint, cursor);

      // no events, early return
      if (!events.length) {
        return { vaasByBlock };
      }

      this.logger.debug(`fetched ${events.length} publish message events`);

      cursor = pagination.endCursor;
      hasNextPage = pagination.hasNextPage;

      const digestArrayWithDups = events.map((e) => e.transaction.digest);
      const digestArray = Array.from(new Set(digestArrayWithDups));

      const txs = await this.fetchTransactions(digestArray);

      const checkpointByTxDigest = txs.reduce<Record<string, string | undefined>>(
        (value, { digest, checkpoint }) => {
          value[digest!] = checkpoint?.toString() || undefined;
          return value;
        },
        {}
      );

      for (const event of events) {
        const checkpoint = checkpointByTxDigest[event.transaction.digest];
        if (!checkpoint) continue;

        const msg = event.contents.json;
        const timestamp = new Date(Number(msg.timestamp) * 1000).toISOString();
        const vaaKey = makeVaaKey(
          event.transaction.digest,
          'Sui',
          msg.sender.slice(2),
          msg.sequence
        );
        const blockKey = makeBlockKey(checkpoint, timestamp);
        vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
      }
    } while (hasNextPage);
    return { vaasByBlock };
  }

  private async fetchCheckpoint(fromCheckpoint: number): Promise<Checkpoint> {
    const { response } = await this.client.ledgerService.getCheckpoint({
      checkpointId: { oneofKind: 'sequenceNumber', sequenceNumber: BigInt(fromCheckpoint) },
      readMask: {
        paths: ['summary'],
      },
    });
    if (!response.checkpoint) {
      throw new Error(`Failed to fetch checkpoint: ${fromCheckpoint}`);
    }
    return response.checkpoint;
  }

  private async fetchEvents(
    from: number,
    to: number,
    cursor?: string
  ): Promise<FetchEventsResponse<PublishMessageEvent>> {
    const { data, errors } = await this.graphql.query<GraphQLFetchEventsResponse>({
      query: this.graphqlEventsQuery(from, to, cursor),
      variables: {},
    });

    if (errors && errors.length > 0) {
      throw new Error(`Failed to fetch events: ${errors.join('\n')}`);
    }

    return {
      events: data!.events.nodes,
      pagination: data!.events.pageInfo,
    };
  }

  private async fetchTransactions(digests: string[]): Promise<ExecutedTransaction[]> {
    const { response } = await this.client.ledgerService.batchGetTransactions({
      digests,
      readMask: {
        paths: ['digest', 'checkpoint'],
      },
    });

    // add the manual cast since typescript won't narrow the type down after the filter
    const results = response.transactions
      .map((r) => r.result)
      .filter((r) => r.oneofKind === 'transaction') as SuccessfulGetTransactionResult[];

    if (results.length !== digests.length) {
      throw new Error(`Expected to get ${digests.length} but got ${results.length}`);
    }

    return results.map((r) => r.transaction);
  }

  private graphqlEventsQuery(from: number, to: number, cursor?: string): string {
    // order is ascending from older to newest
    // checkpoint range is non-inclusive
    return `{
      events(
        filter: {
          type: "${SUI_EVENT_HANDLE}",
          afterCheckpoint: ${from - 1},
          beforeCheckpoint: ${to + 1}
        }
        ${cursor ? `after: "${cursor}"` : ''}
      ) {
        nodes {
          transaction {
            digest
          }
          contents {
            json
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }`;
  }
}
