// https://nomicon.io/Standards/EventsFormat
export type EventLog = {
  event: string;
  standard: string;
  data?: unknown;
  version?: string; // this is supposed to exist but is missing in WH logs
};

export type WormholePublishEventLog = {
  standard: 'wormhole';
  event: 'publish';
  data: string;
  nonce: number;
  emitter: string;
  seq: number;
  block: number;
};

export const isWormholePublishEventLog = (log: EventLog): log is WormholePublishEventLog => {
  return log.standard === 'wormhole' && log.event === 'publish';
};

export type NearExplorerTransactionResponse = {
  id: string | null;
  result: {
    type: string;
    data: {
      items: NearExplorerTransaction[];
    };
  };
}[];

export type NearExplorerTransaction = {
  hash: string;
  signerId: string;
  receiverId: string;
  blockHash: string;
  blockTimestamp: number;
  actions: {
    kind: string;
    args: {
      methodName: string;
      args: string;
      gas: number;
      deposit: string;
    };
  }[];
  status: string;
};

export type NearExplorerTransactionRequestParams = {
  accountId: string;
  limit: number;
  cursor?: {
    timestamp: number; // paginate with timestamp
    indexInChunk: number;
  };
};
