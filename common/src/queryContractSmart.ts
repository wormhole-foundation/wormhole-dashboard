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

// https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/binary.ts#L60-L68
enum WireType {
  Varint = 0,

  Fixed64 = 1,

  Bytes = 2,

  Fixed32 = 5,
}

// https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/binary.ts#L496-L498
function indexOutOfRange(reader: BinaryReader, writeLength?: number) {
  return RangeError(
    'index out of range: ' + reader.pos + ' + ' + (writeLength || 1) + ' > ' + reader.len
  );
}

// adapted from https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/binary.ts#L96
export class BinaryReader {
  buf: Uint8Array;
  pos: number;
  type: number;
  len: number;

  assertBounds(): void {
    if (this.pos > this.len) throw new RangeError('premature EOF');
  }

  constructor(buf: Uint8Array) {
    this.buf = buf;
    this.pos = 0;
    this.type = 0;
    this.len = this.buf.length;
  }

  /**
   * Read an unsigned 32 bit varint.
   *
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/buffer_decoder.js#L220
   */
  varint32read(): number {
    let b = this.buf[this.pos++];
    let result = b & 0x7f;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }

    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 7;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }

    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 14;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }

    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 21;
    if ((b & 0x80) == 0) {
      this.assertBounds();
      return result;
    }

    // Extract only last 4 bits
    b = this.buf[this.pos++];
    result |= (b & 0x0f) << 28;

    for (let readBytes = 5; (b & 0x80) !== 0 && readBytes < 10; readBytes++)
      b = this.buf[this.pos++];

    if ((b & 0x80) != 0) throw new Error('invalid varint');

    this.assertBounds();

    // Result can have 32 bits, convert it to unsigned
    return result >>> 0;
  }

  skip(length?: number) {
    if (typeof length === 'number') {
      if (this.pos + length > this.len) throw indexOutOfRange(this, length);
      this.pos += length;
    } else {
      do {
        if (this.pos >= this.len) throw indexOutOfRange(this);
      } while (this.buf[this.pos++] & 128);
    }
    return this;
  }

  skipType(wireType: number) {
    switch (wireType) {
      case WireType.Varint:
        this.skip();
        break;
      case WireType.Fixed64:
        this.skip(8);
        break;
      case WireType.Bytes:
        this.skip(this.uint32());
        break;
      case 3:
        while ((wireType = this.uint32() & 7) !== 4) {
          this.skipType(wireType);
        }
        break;
      case WireType.Fixed32:
        this.skip(4);
        break;

      /* istanbul ignore next */
      default:
        throw Error('invalid wire type ' + wireType + ' at offset ' + this.pos);
    }
    return this;
  }

  uint32(): number {
    return this.varint32read();
  }

  bytes(): Uint8Array {
    const len = this.uint32(),
      start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
}

// https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/cosmwasm/wasm/v1/query.ts#L111-L118
/**
 * QuerySmartContractStateResponse is the response type for the
 * Query/SmartContractState RPC method
 */
export interface QuerySmartContractStateResponse {
  /** Data contains the json data returned from the smart contract */
  data: Uint8Array;
}

// https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/cosmwasm/wasm/v1/query.ts#L855-L859
function createBaseQuerySmartContractStateResponse(): QuerySmartContractStateResponse {
  return {
    data: new Uint8Array(),
  };
}

// https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/cosmwasm/wasm/v1/query.ts#L871-L887
const QuerySmartContractStateResponse = {
  decode(input: BinaryReader | Uint8Array, length?: number): QuerySmartContractStateResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySmartContractStateResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
};

// https://github.com/cosmos/cosmjs/blob/e819a1fc0e99a3e5320d8d6667a08d3b92e5e836/packages/encoding/src/utf8.ts#L15-L25
/**
 * Takes UTF-8 data and decodes it to a string.
 *
 * In lossy mode, the [REPLACEMENT CHARACTER](https://en.wikipedia.org/wiki/Specials_(Unicode_block))
 * is used to substitude invalid encodings.
 * By default lossy mode is off and invalid data will lead to exceptions.
 */
export function fromUtf8(data: Uint8Array, lossy = false): string {
  const fatal = !lossy;
  return new TextDecoder('utf-8', { fatal }).decode(data);
}

// akin to https://github.com/cosmos/cosmjs/blob/e819a1fc0e99a3e5320d8d6667a08d3b92e5e836/packages/cosmwasm-stargate/src/modules/wasm/queries.ts#L135-L150
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
  // decode like https://github.com/confio/cosmjs-types/blob/66e52711914fccd2a9d1a03e392d3628fdf499e2/src/cosmwasm/wasm/v1/query.ts#L1621
  const { data: responseData } = QuerySmartContractStateResponse.decode(
    Buffer.from(response.data.result.response.value, 'base64')
  );
  // By convention, smart queries must return a valid JSON document (see https://github.com/CosmWasm/cosmwasm/issues/144)
  let responseText: string;
  try {
    responseText = fromUtf8(responseData);
  } catch (error) {
    throw new Error(`Could not UTF-8 decode smart query response from contract: ${error}`);
  }
  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Could not JSON parse smart query response from contract: ${error}`);
  }
}
