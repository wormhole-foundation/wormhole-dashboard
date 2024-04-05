import axios from 'axios';
import { connect } from 'near-api-js';
import { Provider } from 'near-api-js/lib/providers';
import { AXIOS_CONFIG_JSON } from '../consts';
import {
  EventLog,
  GetTransactionsByAccountIdRequestParams,
  GetTransactionsByAccountIdResponse,
  Transaction,
  WormholePublishEventLog,
} from '../types/near';
import { BlockId, BlockResult, ExecutionStatus } from 'near-api-js/lib/providers/provider';
import { Network, contracts } from '@wormhole-foundation/sdk-base';
import { VaasByBlock } from '../databases/types';
import ora from 'ora';
import { makeBlockKey, makeVaaKey } from '../databases/utils';

// The following is obtained by going to: https://explorer.near.org/accounts/contract.wormhole_crypto.near
// and watching the network tab in the browser to see where the explorer is going.
const NEAR_EXPLORER_TRANSACTION_URL =
  'https://explorer-backend-mainnet-prod-24ktefolwq-uc.a.run.app/trpc/transaction.listByAccountId';
export const NEAR_ARCHIVE_RPC = 'https://archival-rpc.mainnet.near.org';

export const getNearProvider = async (network: Network, rpc: string): Promise<Provider> => {
  let connection;
  connection = await connect({ nodeUrl: rpc, networkId: network });
  const provider = connection.connection.provider;
  return provider;
};

// This function can definitely throw.
export async function getTimestampByBlock(
  provider: Provider,
  blockHeight: number
): Promise<number> {
  const block: BlockResult = await fetchBlockByBlockId(provider, blockHeight);
  return block.header.timestamp;
}

// This function can definitely throw.
export async function fetchBlockByBlockId(
  provider: Provider,
  blockHeight: BlockId
): Promise<BlockResult> {
  return await provider.block({ blockId: blockHeight });
}

// This function will only return transactions in the time window.
export const getTransactionsByAccountId = async (
  accountId: string,
  batchSize: number,
  beginningTimestamp: number,
  endingTimestamp: string
): Promise<Transaction[]> => {
  const params: GetTransactionsByAccountIdRequestParams = {
    accountId,
    limit: batchSize,
    cursor: {
      timestamp: endingTimestamp,
      indexInChunk: 0,
    },
  };
  let txs: Transaction[] = [];
  let done: boolean = false;

  while (!done) {
    // using this api: https://github.com/near/near-explorer/blob/beead42ba2a91ad8d2ac3323c29b1148186eec98/backend/src/router/transaction/list.ts#L127
    // console.log(
    //   `Near explorer URL: [${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(
    //     params
    //   )}}]`
    // );
    const res = (
      (
        await axios.get(
          `${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(params)}}`,
          AXIOS_CONFIG_JSON
        )
      ).data as GetTransactionsByAccountIdResponse
    )[0];
    if ('error' in res) throw new Error(res.error.message);
    const numItems: number = res.result.data.items.length;
    const localTxs: Transaction[] = res.result.data.items
      .filter(
        (tx) => tx.status === 'success' && tx.actions.some((a) => a.kind === 'functionCall') // other actions don't generate logs
      )
      .reverse(); // return chronological order
    txs = txs.concat(localTxs);
    if (numItems < batchSize) {
      done = true;
    } else {
      params.cursor = res.result.data.cursor;
    }
    for (const tx of localTxs) {
      // console.log(`Transaction ${tx.hash} at block ${tx.blockTimestamp}`);
      if (tx.blockTimestamp * 1_000_000 >= beginningTimestamp) {
        console.log(
          `Transaction ${tx.hash} at block ${tx.blockTimestamp} is newer than beginning timestamp ${beginningTimestamp}.`
        );
        txs.push(tx);
      } else if (tx.blockTimestamp * 1_000_000 < beginningTimestamp) {
        // This transaction is older than the beginning timestamp, so we're done.
        done = true;
        break;
      }
    }
  }
  return txs;
};

export const isWormholePublishEventLog = (log: EventLog): log is WormholePublishEventLog => {
  return log.standard === 'wormhole' && log.event === 'publish';
};

export const getMessagesFromBlockResults = async (
  network: Network,
  provider: Provider,
  blocks: BlockResult[],
  debug: boolean = false
): Promise<VaasByBlock> => {
  const vaasByBlock: VaasByBlock = {};
  let log: ora.Ora;
  if (debug) log = ora(`Fetching messages from ${blocks.length} blocks...`).start();
  for (let i = 0; i < blocks.length; i++) {
    if (debug) log!.text = `Fetching messages from block ${i + 1}/${blocks.length}...`;
    const { height, timestamp } = blocks[i].header;
    const blockKey = makeBlockKey(height.toString(), new Date(timestamp / 1_000_000).toISOString());
    vaasByBlock[blockKey] = [];

    const chunks = [];
    for (const chunk of blocks[i].chunks) {
      chunks.push(await provider.chunk(chunk.chunk_hash));
    }

    const transactions = chunks.flatMap(({ transactions }) => transactions);
    const coreBridge = contracts.coreBridge.get(network, 'Near');
    if (!coreBridge) {
      throw new Error('Unable to get contract address for Near');
    }
    for (const tx of transactions) {
      const outcome = await provider.txStatus(tx.hash, coreBridge);
      const logs = outcome.receipts_outcome
        .filter(
          ({ outcome }) =>
            (outcome as any).executor_id === coreBridge &&
            (outcome.status as ExecutionStatus).SuccessValue
        )
        .flatMap(({ outcome }) => outcome.logs)
        .filter((log) => log.startsWith('EVENT_JSON:')) // https://nomicon.io/Standards/EventsFormat
        .map((log) => JSON.parse(log.slice(11)) as EventLog)
        .filter(isWormholePublishEventLog);
      for (const log of logs) {
        const vaaKey = makeVaaKey(tx.hash, 'Near', log.emitter, log.seq.toString());
        vaasByBlock[blockKey] = [...vaasByBlock[blockKey], vaaKey];
      }
    }
  }

  if (debug) {
    const numMessages = Object.values(vaasByBlock).flat().length;
    log!.succeed(`Fetched ${numMessages} messages from ${blocks.length} blocks`);
  }

  return vaasByBlock;
};
