import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { VaaHash } from '../../common';
import { EndpointInfo } from './RouterEndpoint';

export type PreparedOrderResponseInfo = {
  preparedBy: PublicKey;
  fastVaaHash: Array<number>;
  fastVaaTimestamp: number;
  sourceChain: number;
  baseFee: BN;
  initAuctionFee: BN;
  sender: Array<number>;
  redeemer: Array<number>;
  amountIn: BN;
};

export class PreparedOrderResponse {
  bump: number;
  info: PreparedOrderResponseInfo;
  toEndpoint: EndpointInfo;
  redeemerMessage: Buffer;

  constructor(
    bump: number,
    info: PreparedOrderResponseInfo,
    toEndpoint: EndpointInfo,
    redeemerMessage: Buffer
  ) {
    this.bump = bump;
    this.info = info;
    this.toEndpoint = toEndpoint;
    this.redeemerMessage = redeemerMessage;
  }

  static address(programId: PublicKey, fastVaaHash: VaaHash) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('order-response'), Buffer.from(fastVaaHash)],
      programId
    )[0];
  }
}
