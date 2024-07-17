import axios from 'axios';
import { Buffer } from 'buffer';

type QueryContractSmartResponse = {
  jsonrpc: '2.0';
  id: number;
  result: {
    response: {
      code: number;
      log: string;
      info: string;
      index: string;
      key: null;
      value: string;
      proofOps: null;
      height: string;
      codespace: string;
    };
  };
};

// adapted from cosmjs-types/binary.js and cosmjs-types/varint.js
export function uint32ToString(val: number): string {
  const num = val < 128 ? 1 : val < 16384 ? 2 : val < 2097152 ? 3 : val < 268435456 ? 4 : 5;
  const buf: number[] = new Array(num);
  let pos = 0;
  while (val > 127) {
    buf[pos++] = (val & 127) | 128;
    val >>>= 7;
  }
  buf[pos] = val;
  return Buffer.from(buf).toString('hex');
}

export async function queryContractSmart(
  rpc: string,
  address: string,
  query: Object
): Promise<any> {
  const addressHex = Buffer.from(address).toString('hex');
  const addressHexLen = uint32ToString(addressHex.length / 2);
  const queryHex = Buffer.from(JSON.stringify(query)).toString('hex');
  const queryStrLen = uint32ToString(queryHex.length / 2);
  const data = `0a${addressHexLen}${addressHex}12${queryStrLen}${queryHex}`;
  const response = await axios.post<QueryContractSmartResponse>(rpc, {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    method: 'abci_query',
    params: {
      path: '/cosmwasm.wasm.v1.Query/SmartContractState',
      data,
      prove: false,
    },
  });
  if (!response.data.result.response.value) {
    if (response.data.result.response.code && response.data.result.response.log) {
      throw new Error(
        `Query failed with (${response.data.result.response.code}) ${response.data.result.response.log}`
      );
    } else {
      throw new Error(`Query failed with unknown error`);
    }
  }
  const asciiResponse = Buffer.from(response.data.result.response.value, 'base64').toString(
    'ascii'
  );
  return JSON.parse(
    asciiResponse.substring(asciiResponse.indexOf('{') || asciiResponse.indexOf('['))
  );
}
