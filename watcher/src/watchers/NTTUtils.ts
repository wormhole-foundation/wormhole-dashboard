// Everything in this file is wholly copied from https://github.com/wormhole-foundation/wormhole/blob/a4aad23507cd124590074c222c01b8f4225cf843/sdk/js/src/relayer/structs.ts#L1
import * as providers from '@ethersproject/providers';
import { BigNumber, ethers } from 'ethers';

export enum RelayerPayloadId {
  Delivery = 1,
  Redelivery = 2,
}

export enum KeyType {
  VAA = 1,
  CCTP = 2,
}
export interface MessageKey {
  keyType: KeyType | number;
  key: ethers.BytesLike;
}

export interface VaaKey {
  chainId: number;
  emitterAddress: Buffer;
  sequence: BigNumber;
}

export interface DeliveryInstruction {
  targetChainId: number;
  targetAddress: Buffer;
  payload: Buffer;
  requestedReceiverValue: BigNumber;
  extraReceiverValue: BigNumber;
  encodedExecutionInfo: Buffer;
  refundChainId: number;
  refundAddress: Buffer;
  refundDeliveryProvider: Buffer;
  sourceDeliveryProvider: Buffer;
  senderAddress: Buffer;
  messageKeys: MessageKey[];
}

export interface RedeliveryInstruction {
  deliveryVaaKey: VaaKey;
  targetChainId: number;
  newRequestedReceiverValue: BigNumber;
  newEncodedExecutionInfo: Buffer;
  newSourceDeliveryProvider: Buffer;
  newSenderAddress: Buffer;
}

export function parseWormholeRelayerPayloadType(
  stringPayload: string | Buffer | Uint8Array
): RelayerPayloadId {
  const payload =
    typeof stringPayload === 'string' ? ethers.utils.arrayify(stringPayload) : stringPayload;
  if (payload[0] != RelayerPayloadId.Delivery && payload[0] != RelayerPayloadId.Redelivery) {
    throw new Error('Unrecognized payload type ' + payload[0]);
  }
  return payload[0];
}

function parsePayload(bytes: Buffer, idx: number): [Buffer, number] {
  const length = bytes.readUInt32BE(idx);
  idx += 4;
  const payload = bytes.slice(idx, idx + length);
  idx += length;
  return [payload, idx];
}

export function parseMessageKey(_bytes: ethers.utils.BytesLike, idx: number): [MessageKey, number] {
  const bytes = Buffer.from(ethers.utils.arrayify(_bytes));
  const keyType = bytes.readUInt8(idx);
  idx += 1;
  if (keyType === KeyType.VAA) {
    const vaaKeyLength = 2 + 32 + 8;
    return [{ keyType, key: bytes.slice(idx, idx + vaaKeyLength) }, idx + 2 + 32 + 8];
  } else {
    const len = bytes.readUInt32BE(idx);
    idx += 4;
    return [{ keyType, key: bytes.slice(idx, idx + len) }, idx + len];
  }
}

export function parseWormholeRelayerSend(bytes: Buffer): DeliveryInstruction {
  let idx = 0;
  const payloadId = bytes.readUInt8(idx);
  if (payloadId !== RelayerPayloadId.Delivery) {
    throw new Error(
      `Expected Delivery payload type (${RelayerPayloadId.Delivery}), found: ${payloadId}`
    );
  }
  idx += 1;
  const targetChainId = bytes.readUInt16BE(idx);
  idx += 2;
  const targetAddress = bytes.slice(idx, idx + 32);
  idx += 32;
  let payload: Buffer;
  [payload, idx] = parsePayload(bytes, idx);
  const requestedReceiverValue = ethers.BigNumber.from(
    Uint8Array.prototype.subarray.call(bytes, idx, idx + 32)
  );
  idx += 32;
  const extraReceiverValue = ethers.BigNumber.from(
    Uint8Array.prototype.subarray.call(bytes, idx, idx + 32)
  );
  idx += 32;
  let encodedExecutionInfo;
  [encodedExecutionInfo, idx] = parsePayload(bytes, idx);
  const refundChainId = bytes.readUInt16BE(idx);
  idx += 2;
  const refundAddress = bytes.slice(idx, idx + 32);
  idx += 32;
  const refundDeliveryProvider = bytes.slice(idx, idx + 32);
  idx += 32;
  const sourceDeliveryProvider = bytes.slice(idx, idx + 32);
  idx += 32;
  const senderAddress = bytes.slice(idx, idx + 32);
  idx += 32;
  const numMessages = bytes.readUInt8(idx);
  idx += 1;
  let messageKeys = [] as MessageKey[];
  for (let i = 0; i < numMessages; ++i) {
    const res = parseMessageKey(bytes, idx);
    idx = res[1];
    messageKeys.push(res[0]);
  }

  return {
    targetChainId,
    targetAddress,
    payload,
    requestedReceiverValue,
    extraReceiverValue,
    encodedExecutionInfo,
    refundChainId,
    refundAddress,
    refundDeliveryProvider,
    sourceDeliveryProvider,
    senderAddress,
    messageKeys: messageKeys,
  };
}

export function parseVaaKey(_bytes: ethers.BytesLike): VaaKey {
  const bytes = Buffer.from(ethers.utils.arrayify(_bytes));
  let idx = 0;
  const chainId = bytes.readUInt16BE(idx);
  idx += 2;
  const emitterAddress = bytes.slice(idx, idx + 32);
  idx += 32;
  const sequence = ethers.BigNumber.from(Uint8Array.prototype.subarray.call(bytes, idx, idx + 8));
  idx += 8;
  return {
    chainId,
    emitterAddress,
    sequence,
  };
}

export function parseWormholeRelayerResend(bytes: Buffer): RedeliveryInstruction {
  let idx = 0;
  const payloadId = bytes.readUInt8(idx);
  if (payloadId !== RelayerPayloadId.Redelivery) {
    throw new Error(
      `Expected Delivery payload type (${RelayerPayloadId.Redelivery}), found: ${payloadId}`
    );
  }
  idx += 1;

  let parsedMessageKey: MessageKey;
  [parsedMessageKey, idx] = parseMessageKey(bytes, idx);
  const key: VaaKey = parseVaaKey(parsedMessageKey.key);

  const targetChainId: number = bytes.readUInt16BE(idx);
  idx += 2;

  const newRequestedReceiverValue = ethers.BigNumber.from(
    Uint8Array.prototype.subarray.call(bytes, idx, idx + 32)
  );
  idx += 32;

  let newEncodedExecutionInfo;
  [newEncodedExecutionInfo, idx] = parsePayload(bytes, idx);

  const newSourceDeliveryProvider = bytes.slice(idx, idx + 32);
  idx += 32;

  const newSenderAddress = bytes.slice(idx, idx + 32);
  idx += 32;
  return {
    deliveryVaaKey: key,
    targetChainId,
    newRequestedReceiverValue,
    newEncodedExecutionInfo,
    newSourceDeliveryProvider,
    newSenderAddress,
  };
}

export function parseWormholeLog(log: providers.Log): {
  type: RelayerPayloadId;
  parsed: DeliveryInstruction | RedeliveryInstruction | string;
} {
  const abi = [
    'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
  ];
  const iface = new ethers.utils.Interface(abi);
  const parsed = iface.parseLog(log);
  const payload = Buffer.from(parsed.args.payload.substring(2), 'hex');
  const type = parseWormholeRelayerPayloadType(payload);
  if (type == RelayerPayloadId.Delivery) {
    return { type, parsed: parseWormholeRelayerSend(payload) };
  } else if (type == RelayerPayloadId.Redelivery) {
    return { type, parsed: parseWormholeRelayerResend(payload) };
  } else {
    throw Error('Invalid wormhole log');
  }
}
