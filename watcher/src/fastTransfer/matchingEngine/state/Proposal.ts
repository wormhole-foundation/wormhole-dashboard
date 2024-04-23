import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { AuctionParameters } from './AuctionConfig';
import { Uint64, uint64ToBN, writeUint64BE } from '../../common';

export type ProposalAction = {
  none?: {};
  updateAuctionParameters?: {
    id: number;
    parameters: AuctionParameters;
  };
};

export class Proposal {
  id: BN;
  bump: number;
  action: ProposalAction;
  by: PublicKey;
  owner: PublicKey;
  slotProposedAt: BN;
  slotEnactDelay: BN;
  slotEnactedAt: BN | null;
  constructor(
    id: BN,
    bump: number,
    action: ProposalAction,
    by: PublicKey,
    owner: PublicKey,
    slotProposedAt: Uint64,
    slotEnactDelay: Uint64,
    slotEnactedAt: Uint64 | null
  ) {
    this.id = id;
    this.bump = bump;
    this.action = action;
    this.by = by;
    this.owner = owner;
    this.slotProposedAt = uint64ToBN(slotProposedAt);
    this.slotEnactDelay = uint64ToBN(slotEnactDelay);
    this.slotEnactedAt = slotEnactedAt === null ? null : uint64ToBN(slotEnactedAt);
  }

  static address(programId: PublicKey, nextProposalId: Uint64) {
    const encodedProposalId = Buffer.alloc(8);
    writeUint64BE(encodedProposalId, nextProposalId);

    return PublicKey.findProgramAddressSync(
      [Buffer.from('proposal'), encodedProposalId],
      programId
    )[0];
  }
}
