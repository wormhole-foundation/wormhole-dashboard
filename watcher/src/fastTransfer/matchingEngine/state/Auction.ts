import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { MessageProtocol } from './RouterEndpoint';

export type AuctionStatus = {
  notStarted?: {};
  active?: {};
  completed?: { slot: BN; executePenalty: BN | null };
  settled?: {
    fee: BN;
    totalPenalty: BN | null;
  };
};

export type AuctionDestinationAssetInfo = {
  custodyTokenBump: number;
  amountOut: BN;
};

export type AuctionInfo = {
  configId: number;
  custodyTokenBump: number;
  vaaSequence: BN;
  sourceChain: number;
  bestOfferToken: PublicKey;
  initialOfferToken: PublicKey;
  startSlot: BN;
  amountIn: BN;
  securityDeposit: BN;
  offerPrice: BN;
  destinationAssetInfo: AuctionDestinationAssetInfo | null;
};

export class Auction {
  bump: number;
  vaaHash: number[];
  vaaTimestamp: number;
  targetProtocol: MessageProtocol;
  status: AuctionStatus;
  info: AuctionInfo | null;

  constructor(
    bump: number,
    vaaHash: number[],
    vaaTimestamp: number,
    targetProtocol: MessageProtocol,
    status: AuctionStatus,
    info: AuctionInfo | null
  ) {
    this.bump = bump;
    this.vaaHash = vaaHash;
    this.vaaTimestamp = vaaTimestamp;
    this.targetProtocol = targetProtocol;
    this.status = status;
    this.info = info;
  }

  static address(programId: PublicKey, vaaHash: Array<number> | Buffer | Uint8Array) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('auction'), Buffer.from(vaaHash)],
      programId
    )[0];
  }
}
