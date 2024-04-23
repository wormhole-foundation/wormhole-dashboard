import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { emitterAddress } from '../../common';

export class Custodian {
  owner: PublicKey;
  pendingOwner: PublicKey | null;
  paused: boolean;
  pausedSetBy: PublicKey | null;
  ownerAssistant: PublicKey;
  feeRecipientToken: PublicKey;
  auctionConfigId: number;
  nextProposalId: BN;

  constructor(
    owner: PublicKey,
    pendingOwner: PublicKey | null,
    paused: boolean,
    pausedSetBy: PublicKey | null,
    ownerAssistant: PublicKey,
    feeRecipientToken: PublicKey,
    auctionConfigId: number,
    nextProposalId: BN
  ) {
    this.owner = owner;
    this.pendingOwner = pendingOwner;
    this.paused = paused;
    this.pausedSetBy = pausedSetBy;
    this.ownerAssistant = ownerAssistant;
    this.feeRecipientToken = feeRecipientToken;
    this.auctionConfigId = auctionConfigId;
    this.nextProposalId = nextProposalId;
  }

  static address(programId: PublicKey) {
    return emitterAddress(programId);
  }
}
