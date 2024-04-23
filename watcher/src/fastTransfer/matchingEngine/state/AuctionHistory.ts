import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { AuctionInfo } from './Auction';
import { Uint64, writeUint64BE } from '../../common';

export type AuctionHistoryHeader = {
  id: BN;
  minTimestamp: number | null;
  maxTimestamp: number | null;
};

export type AuctionEntry = {
  vaaHash: Array<number>;
  vaaTimestamp: number;
  info: AuctionInfo;
};

export class AuctionHistory {
  header: AuctionHistoryHeader;
  data: Array<AuctionEntry>;

  constructor(header: AuctionHistoryHeader, data: Array<AuctionEntry>) {
    this.header = header;
    this.data = data;
  }

  static address(programId: PublicKey, id: Uint64) {
    const encodedId = Buffer.alloc(8);
    writeUint64BE(encodedId, id);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('auction-history'), encodedId],
      programId
    )[0];
  }
}
