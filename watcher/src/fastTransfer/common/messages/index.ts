import * as wormholeSdk from '@certusone/wormhole-sdk';
import { Fill, ID_DEPOSIT, LiquidityLayerDeposit } from './deposit';

export * from './deposit';

export const ID_FAST_MARKET_ORDER = 11;
export const ID_FAST_FILL = 12;

export type FastFill = {
  // u64
  amount: bigint;
  fill: Fill;
};

export type FastMarketOrder = {
  // u64
  amountIn: bigint;
  // u64
  minAmountOut: bigint;
  targetChain: wormholeSdk.ChainId;
  redeemer: Array<number>;
  sender: Array<number>;
  refundAddress: Array<number>;
  // u64
  maxFee: bigint;
  // u64
  initAuctionFee: bigint;
  deadline: number;
  redeemerMessage: Buffer;
};

export class LiquidityLayerMessage {
  deposit?: LiquidityLayerDeposit;
  fastFill?: FastFill;
  fastMarketOrder?: FastMarketOrder;

  constructor(message: {
    deposit?: LiquidityLayerDeposit;
    fastFill?: FastFill;
    fastMarketOrder?: FastMarketOrder;
  }) {
    const { deposit, fastFill, fastMarketOrder } = message;
    this.deposit = deposit;
    this.fastFill = fastFill;
    this.fastMarketOrder = fastMarketOrder;
  }

  static decode(buf: Buffer): LiquidityLayerMessage {
    let offset = 0;
    const payloadId = buf.readUInt8(offset);
    offset += 1;

    const { deposit, fastFill, fastMarketOrder } = (() => {
      switch (payloadId) {
        case ID_DEPOSIT: {
          return {
            deposit: LiquidityLayerDeposit.decode(buf),
            fastFill: undefined,
            fastMarketOrder: undefined,
          };
        }
        case ID_FAST_MARKET_ORDER: {
          const amountIn = buf.readBigUInt64BE(offset);
          offset += 8;
          const minAmountOut = buf.readBigUInt64BE(offset);
          offset += 8;
          const targetChain = buf.readUInt16BE(offset);
          offset += 2;
          const redeemer = Array.from(buf.subarray(offset, (offset += 32)));
          const sender = Array.from(buf.subarray(offset, (offset += 32)));
          const refundAddress = Array.from(buf.subarray(offset, (offset += 32)));
          const maxFee = buf.readBigInt64BE(offset);
          offset += 8;
          const initAuctionFee = buf.readBigInt64BE(offset);
          const deadline = buf.readUInt32BE(offset);
          offset += 4;
          const redeemerMessageLen = buf.readUInt32BE(offset);
          offset += 4;
          const redeemerMessage = buf.subarray(offset, (offset += redeemerMessageLen));
          return {
            deposit: undefined,
            fastFill: undefined,
            fastMarketOrder: {
              amountIn,
              minAmountOut,
              targetChain,
              redeemer,
              sender,
              refundAddress,
              maxFee,
              initAuctionFee,
              deadline,
              redeemerMessage,
            } as FastMarketOrder,
          };
        }
        case ID_FAST_FILL: {
          const amount = buf.readBigUInt64BE(offset);
          offset += 8;
          const sourceChain = buf.readUInt16BE(offset);
          offset += 2;
          const orderSender = Array.from(buf.subarray(offset, (offset += 32)));
          const redeemer = Array.from(buf.subarray(offset, (offset += 32)));
          const redeemerMessageLen = buf.readUInt32BE(offset);
          offset += 4;
          const redeemerMessage = buf.subarray(offset, (offset += redeemerMessageLen));
          return {
            deposit: undefined,
            fastFill: {
              amount,
              fill: { sourceChain, orderSender, redeemer, redeemerMessage },
            } as FastFill,
            fastMarketOrder: undefined,
          };
        }
        default: {
          throw new Error('Invalid Liquidity Layer message');
        }
      }
    })();

    return new LiquidityLayerMessage({ deposit, fastFill, fastMarketOrder });
  }

  encode(): Buffer {
    const { deposit, fastFill, fastMarketOrder } = this;

    const buf = (() => {
      if (deposit !== undefined) {
        return deposit.encode();
      } else if (fastFill !== undefined) {
        const { fill, amount } = fastFill;
        const { sourceChain, orderSender, redeemer, redeemerMessage } = fill;

        const messageBuf = Buffer.alloc(1 + 78 + redeemerMessage.length);

        let offset = 0;
        offset = messageBuf.writeUInt8(ID_FAST_FILL, offset);
        offset = messageBuf.writeBigUInt64BE(amount, offset);
        offset = messageBuf.writeUInt16BE(sourceChain, offset);
        messageBuf.set(orderSender, offset);
        offset += orderSender.length;
        messageBuf.set(redeemer, offset);
        offset += redeemer.length;
        offset = messageBuf.writeUInt32BE(redeemerMessage.length, offset);
        messageBuf.set(redeemerMessage, offset);
        offset += redeemerMessage.length;

        return messageBuf;
      } else if (fastMarketOrder !== undefined) {
        const {
          amountIn,
          minAmountOut,
          targetChain,
          redeemer,
          sender,
          refundAddress,
          maxFee,
          initAuctionFee,
          deadline,
          redeemerMessage,
        } = fastMarketOrder;

        const messageBuf = Buffer.alloc(1 + 138 + redeemerMessage.length);

        let offset = 0;
        offset = messageBuf.writeUInt8(ID_FAST_MARKET_ORDER, offset);
        offset = messageBuf.writeBigUInt64BE(amountIn, offset);
        offset = messageBuf.writeBigUInt64BE(minAmountOut, offset);
        offset = messageBuf.writeUInt16BE(targetChain, offset);
        messageBuf.set(redeemer, offset);
        offset += redeemer.length;
        messageBuf.set(sender, offset);
        offset += sender.length;
        messageBuf.set(refundAddress, offset);
        offset += refundAddress.length;
        offset = messageBuf.writeBigUInt64BE(maxFee, offset);
        offset = messageBuf.writeBigUInt64BE(initAuctionFee, offset);
        offset = messageBuf.writeUInt32BE(deadline, offset);
        offset = messageBuf.writeUInt32BE(redeemerMessage.length, offset);
        messageBuf.set(redeemerMessage, offset);
        offset += redeemerMessage.length;

        return messageBuf;
      } else {
        throw new Error('Invalid Liquidity Layer message');
      }
    })();

    return buf;
  }
}
