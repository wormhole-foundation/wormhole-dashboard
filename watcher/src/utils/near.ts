import { sleep } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { connect } from 'near-api-js';
import { JsonRpcProvider, Provider } from 'near-api-js/lib/providers';
import { AXIOS_CONFIG_JSON } from '../consts';
import {
  GetTransactionsByAccountIdRequestParams,
  GetTransactionsByAccountIdResponse,
  Transaction,
} from '../types/near';

const NEAR_ARCHIVE_RPC = 'https://archival-rpc.mainnet.near.org';
const NEAR_EXPLORER_TRANSACTION_URL =
  'https://backend-mainnet-1713.onrender.com/trpc/transaction.listByAccountId';
export const ARCHIVAL_NODE_RATE_LIMIT_MS = 100;

export const getArchivalRpcProvider = async (): Promise<Provider> => {
  const connection = await connect({ nodeUrl: NEAR_ARCHIVE_RPC, networkId: 'mainnet' });
  const provider = connection.connection.provider as JsonRpcProvider;
  const originalFn = provider.sendJsonRpc;
  provider.sendJsonRpc = async function <T>(method: string, params: object) {
    await sleep(ARCHIVAL_NODE_RATE_LIMIT_MS); // respect rate limits: 600req/min
    return originalFn.call(this, method, params) as Promise<T>;
  };

  return provider;
};

export const getTransactionsByAccountId = async (
  accountId: string,
  batchSize: number,
  timestamp: string
): Promise<Transaction[]> => {
  const params: GetTransactionsByAccountIdRequestParams = {
    accountId,
    limit: batchSize,
    cursor: {
      timestamp,
      indexInChunk: 0,
    },
  };

  // using this api: https://github.com/near/near-explorer/blob/beead42ba2a91ad8d2ac3323c29b1148186eec98/backend/src/router/transaction/list.ts#L127
  const res = (
    (
      await axios.get(
        `${NEAR_EXPLORER_TRANSACTION_URL}?batch=1&input={"0":${JSON.stringify(params)}}`,
        AXIOS_CONFIG_JSON
      )
    ).data as GetTransactionsByAccountIdResponse
  )[0];
  if ('error' in res) throw new Error(res.error.message);
  return res.result.data.items.filter(
    (tx) => tx.status === 'success' && tx.actions.some((a) => a.kind === 'functionCall') // other actions don't generate logs
  );
};
