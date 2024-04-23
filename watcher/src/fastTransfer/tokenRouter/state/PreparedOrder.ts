import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Keccak } from 'sha3';
import { Uint64, uint64ToBN } from '../../common';

export type OrderType = {
  market?: {
    minAmountOut: BN | null;
  };
};

export type PreparedOrderInfo = {
  preparedCustodyTokenBump: number;
  orderSender: PublicKey;
  preparedBy: PublicKey;
  orderType: OrderType;
  srcToken: PublicKey;
  refundToken: PublicKey;
  targetChain: number;
  redeemer: Array<number>;
};

export class PreparedOrder {
  info: PreparedOrderInfo;
  redeemerMessage: Buffer;

  constructor(info: PreparedOrderInfo, redeemerMessage: Buffer) {
    this.info = info;
    this.redeemerMessage = redeemerMessage;
  }
}
