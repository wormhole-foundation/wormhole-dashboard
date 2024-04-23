import * as wormholeSdk from '@certusone/wormhole-sdk';
import { ethers } from 'ethers';

export const ID_DEPOSIT = 1;

export const ID_DEPOSIT_FILL = 1;
export const ID_DEPOSIT_SLOW_ORDER_RESPONSE = 2;

export type DepositHeader = {
  tokenAddress: Array<number>;
  amount: bigint;
  sourceCctpDomain: number;
  destinationCctpDomain: number;
  cctpNonce: bigint;
  burnSource: Array<number>;
  mintRecipient: Array<number>;
};

export type Fill = {
  sourceChain: wormholeSdk.ChainId;
  orderSender: Array<number>;
  redeemer: Array<number>;
  redeemerMessage: Buffer;
};

export type SlowOrderResponse = {
  // u64
  baseFee: bigint;
};

export type LiquidityLayerDepositMessage = {
  fill?: Fill;
  slowOrderResponse?: SlowOrderResponse;
};

export class LiquidityLayerDeposit {
  header: DepositHeader;
  message: LiquidityLayerDepositMessage;

  constructor(header: DepositHeader, message: LiquidityLayerDepositMessage) {
    this.header = header;
    this.message = message;
  }

  static decode(buf: Buffer): LiquidityLayerDeposit {
    let offset = 0;
    const payloadId = buf.readUInt8(offset);
    offset += 1;
    if (payloadId != 1) {
      throw new Error('Invalid Wormhole CCTP deposit message');
    }

    const tokenAddress = Array.from(buf.subarray(offset, (offset += 32)));
    const amount = BigInt(ethers.BigNumber.from(buf.subarray(offset, (offset += 32))).toString());
    const sourceCctpDomain = buf.readUInt32BE(offset);
    offset += 4;
    const destinationCctpDomain = buf.readUInt32BE(offset);
    offset += 4;
    const cctpNonce = buf.readBigUint64BE(offset);
    offset += 8;
    const burnSource = Array.from(buf.subarray(offset, (offset += 32)));
    const mintRecipient = Array.from(buf.subarray(offset, (offset += 32)));
    const payloadLen = buf.readUInt16BE(offset);
    offset += 2;
    const payload = buf.subarray(offset, (offset += payloadLen));

    offset = 0;
    const depositPayloadId = payload.readUInt8(offset);
    offset += 1;

    const message = (() => {
      switch (depositPayloadId) {
        case ID_DEPOSIT_FILL: {
          const sourceChain = payload.readUInt16BE(offset);
          if (!wormholeSdk.isChain(sourceChain)) {
            throw new Error('Invalid source chain');
          }
          offset += 2;
          const orderSender = Array.from(payload.subarray(offset, (offset += 32)));
          const redeemer = Array.from(payload.subarray(offset, (offset += 32)));
          const redeemerMessageLen = payload.readUInt32BE(offset);
          offset += 4;
          const redeemerMessage = payload.subarray(offset, (offset += redeemerMessageLen));
          return {
            fill: { sourceChain, orderSender, redeemer, redeemerMessage },
          };
        }
        case ID_DEPOSIT_SLOW_ORDER_RESPONSE: {
          const baseFee = payload.readBigUInt64BE(offset);
          return {
            slowOrderResponse: { baseFee },
          };
        }
        default: {
          throw new Error('Invalid Liquidity Layer deposit message');
        }
      }
    })();

    return new LiquidityLayerDeposit(
      {
        tokenAddress,
        amount,
        sourceCctpDomain,
        destinationCctpDomain,
        cctpNonce,
        burnSource,
        mintRecipient,
      },
      message
    );
  }

  encode(): Buffer {
    const buf = Buffer.alloc(146);

    const { header, message } = this;
    const {
      tokenAddress,
      amount,
      sourceCctpDomain,
      destinationCctpDomain,
      cctpNonce,
      burnSource,
      mintRecipient,
    } = header;

    let offset = 0;
    buf.set(tokenAddress, offset);
    offset += 32;

    // Special handling w/ uint256. This value will most likely encoded in < 32 bytes, so we
    // jump ahead by 32 and subtract the length of the encoded value.
    const encodedAmount = ethers.utils.arrayify(ethers.BigNumber.from(amount.toString()));
    buf.set(encodedAmount, (offset += 32) - encodedAmount.length);

    offset = buf.writeUInt32BE(sourceCctpDomain, offset);
    offset = buf.writeUInt32BE(destinationCctpDomain, offset);
    offset = buf.writeBigUInt64BE(cctpNonce, offset);
    buf.set(burnSource, offset);
    offset += burnSource.length;
    buf.set(mintRecipient, offset);
    offset += mintRecipient.length;

    const { fill, slowOrderResponse } = message;
    const payload = (() => {
      if (fill !== undefined) {
        const { sourceChain, orderSender, redeemer, redeemerMessage } = fill;

        const messageBuf = Buffer.alloc(1 + 70 + redeemerMessage.length);

        let offset = 0;
        offset = messageBuf.writeUInt8(ID_DEPOSIT_FILL, offset);
        offset = messageBuf.writeUInt16BE(sourceChain, offset);
        messageBuf.set(orderSender, offset);
        offset += orderSender.length;
        messageBuf.set(redeemer, offset);
        offset += redeemer.length;
        offset = messageBuf.writeUInt32BE(redeemerMessage.length, offset);
        messageBuf.set(redeemerMessage, offset);
        offset += redeemerMessage.length;

        return messageBuf;
      } else if (slowOrderResponse !== undefined) {
        const { baseFee } = slowOrderResponse;

        const messageBuf = Buffer.alloc(1 + 8);
        let offset = 0;
        offset = messageBuf.writeUInt8(ID_DEPOSIT_SLOW_ORDER_RESPONSE, offset);
        offset = messageBuf.writeBigUInt64BE(baseFee, offset);

        return messageBuf;
      } else {
        throw new Error('Invalid Liquidity Layer deposit message');
      }
    })();

    // Finally write the length.
    buf.writeUInt16BE(payload.length, offset);

    return Buffer.concat([Buffer.alloc(1, ID_DEPOSIT), buf, payload]);
  }
}
