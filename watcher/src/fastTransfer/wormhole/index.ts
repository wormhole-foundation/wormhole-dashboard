import * as wormholeSdk from '@certusone/wormhole-sdk';
import { parseVaa } from '@certusone/wormhole-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

export type EncodedVaa = {
  status: number;
  writeAuthority: PublicKey;
  version: number;
  buf: Buffer;
};

export type PostedVaaV1 = {
  consistencyLevel: number;
  timestamp: number;
  signatureSet: PublicKey;
  guardianSetIndex: number;
  nonce: number;
  sequence: bigint;
  emitterChain: wormholeSdk.ChainId;
  emitterAddress: Array<number>;
  payload: Buffer;
};

export type EmitterInfo = {
  chain: wormholeSdk.ChainId;
  address: Array<number>;
  sequence: bigint;
};

export class VaaAccount {
  private _encodedVaa?: EncodedVaa;
  private _postedVaaV1?: PostedVaaV1;

  static async fetch(connection: Connection, addr: PublicKey): Promise<VaaAccount> {
    const accInfo = await connection.getAccountInfo(addr);
    if (accInfo === null) {
      throw new Error('no VAA account info found');
    }
    const { data } = accInfo;

    let offset = 0;
    const disc = data.subarray(offset, (offset += 8));
    if (disc.equals(Uint8Array.from([226, 101, 163, 4, 133, 160, 84, 245]))) {
      const status = data[offset];
      offset += 1;
      const writeAuthority = new PublicKey(data.subarray(offset, (offset += 32)));
      const version = data[offset];
      offset += 1;
      const bufLen = data.readUInt32LE(offset);
      offset += 4;
      const buf = data.subarray(offset, (offset += bufLen));

      return new VaaAccount({ encodedVaa: { status, writeAuthority, version, buf } });
    } else if (disc.subarray(0, (offset -= 4)).equals(Uint8Array.from([118, 97, 97, 1]))) {
      const consistencyLevel = data[offset];
      offset += 1;
      const timestamp = data.readUInt32LE(offset);
      offset += 4;
      const signatureSet = new PublicKey(data.subarray(offset, (offset += 32)));
      const guardianSetIndex = data.readUInt32LE(offset);
      offset += 4;
      const nonce = data.readUInt32LE(offset);
      offset += 4;
      const sequence = data.readBigUInt64LE(offset);
      offset += 8;
      const emitterChain = data.readUInt16LE(offset);
      if (!wormholeSdk.isChain(emitterChain)) {
        throw new Error('invalid emitter chain');
      }
      offset += 2;
      const emitterAddress = Array.from(data.subarray(offset, (offset += 32)));
      const payloadLen = data.readUInt32LE(offset);
      offset += 4;
      const payload = data.subarray(offset, (offset += payloadLen));

      return new VaaAccount({
        postedVaaV1: {
          consistencyLevel,
          timestamp,
          signatureSet,
          guardianSetIndex,
          nonce,
          sequence,
          emitterChain,
          emitterAddress,
          payload,
        },
      });
    } else {
      throw new Error('invalid VAA account data');
    }
  }

  emitterInfo(): EmitterInfo {
    if (this._encodedVaa !== undefined) {
      const parsed = parseVaa(this._encodedVaa.buf);
      return {
        chain: parsed.emitterChain as wormholeSdk.ChainId,
        address: Array.from(parsed.emitterAddress),
        sequence: parsed.sequence,
      };
    } else if (this._postedVaaV1 !== undefined) {
      const { emitterChain: chain, emitterAddress: address, sequence } = this._postedVaaV1;
      return {
        chain,
        address,
        sequence,
      };
    } else {
      throw new Error('impossible: emitterInfo() failed');
    }
  }

  timestamp(): number {
    if (this._encodedVaa !== undefined) {
      return parseVaa(this._encodedVaa.buf).timestamp;
    } else if (this._postedVaaV1 !== undefined) {
      return this._postedVaaV1.timestamp;
    } else {
      throw new Error('impossible: timestamp() failed');
    }
  }

  payload(): Buffer {
    if (this._encodedVaa !== undefined) {
      return parseVaa(this._encodedVaa.buf).payload;
    } else if (this._postedVaaV1 !== undefined) {
      return this._postedVaaV1.payload;
    } else {
      throw new Error('impossible: payload() failed');
    }
  }

  digest(): Uint8Array {
    if (this._encodedVaa !== undefined) {
      return ethers.utils.arrayify(ethers.utils.keccak256(parseVaa(this._encodedVaa.buf).hash));
    } else if (this._postedVaaV1 !== undefined) {
      const {
        consistencyLevel,
        timestamp,
        nonce,
        sequence,
        emitterChain,
        emitterAddress,
        payload,
      } = this._postedVaaV1;

      let offset = 0;
      const buf = Buffer.alloc(51 + payload.length);
      offset = buf.writeUInt32BE(timestamp, offset);
      offset = buf.writeUInt32BE(nonce, offset);
      offset = buf.writeUInt16BE(emitterChain, offset);
      buf.set(emitterAddress, offset);
      offset += 32;
      offset = buf.writeBigUInt64BE(sequence, offset);
      offset = buf.writeUInt8(consistencyLevel, offset);
      buf.set(payload, offset);

      return ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.keccak256(buf)));
    } else {
      throw new Error('impossible: digest() failed');
    }
  }

  get encodedVaa(): EncodedVaa {
    if (this._encodedVaa === undefined) {
      throw new Error('VaaAccount does not have encodedVaa');
    }
    return this._encodedVaa;
  }

  get postedVaaV1(): PostedVaaV1 {
    if (this._postedVaaV1 === undefined) {
      throw new Error('VaaAccount does not have postedVaaV1');
    }
    return this._postedVaaV1;
  }

  private constructor(data: { encodedVaa?: EncodedVaa; postedVaaV1?: PostedVaaV1 }) {
    const { encodedVaa, postedVaaV1 } = data;
    if (encodedVaa !== undefined && postedVaaV1 !== undefined) {
      throw new Error('VaaAccount cannot have both encodedVaa and postedVaaV1');
    }

    this._encodedVaa = encodedVaa;
    this._postedVaaV1 = postedVaaV1;
  }
}
