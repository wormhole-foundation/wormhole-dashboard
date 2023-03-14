import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';

export type ObservedEventInfo = {
  info: {
    timestamp: {
      value: string;
      timestamp: string;
    }[];
    txHash: {
      value: string;
      timestamp: string;
    }[];
    hasSignedVaa: {
      value: string;
      timestamp: string;
    }[];
  };
};

export type ObservedEvent = {
  id: string;
  data: ObservedEventInfo;
};

export type ObservedMessage = {
  id: string;
  chain: number;
  block: number;
  emitter: string;
  seq: string;
  timestamp: any;
  txHash: any;
  hasSignedVaa: any;
};

export type ObservedMessageResponse = {
  messages: ObservedMessage[];
  lastUpdated: number;
  lastRowKey: string;
};

export type MessagesByChain = {
  [chain in ChainId]: ObservedMessageResponse;
};

export function makeCache() {
  const cache: MessagesByChain = {
    0: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    1: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    2: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    3: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    4: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    5: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    6: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    7: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    8: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    9: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    10: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    11: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    12: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    13: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    14: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    15: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    16: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    17: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    18: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    19: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    20: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    21: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    22: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    23: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    24: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    25: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    26: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    28: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    29: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
    3104: {
      messages: [],
      lastUpdated: 0,
      lastRowKey: '',
    },
  };
  return cache;
}
