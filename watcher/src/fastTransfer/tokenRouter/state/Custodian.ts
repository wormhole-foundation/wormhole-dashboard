import { PublicKey } from '@solana/web3.js';
import { emitterAddress } from '../../common';

export class Custodian {
  paused: boolean;
  owner: PublicKey;
  pendingOwner: PublicKey | null;
  ownerAssistant: PublicKey;
  pausedSetBy: PublicKey;

  constructor(
    paused: boolean,
    owner: PublicKey,
    pendingOwner: PublicKey | null,
    ownerAssistant: PublicKey,
    pausedSetBy: PublicKey
  ) {
    this.paused = paused;
    this.owner = owner;
    this.pendingOwner = pendingOwner;
    this.ownerAssistant = ownerAssistant;
    this.pausedSetBy = pausedSetBy;
  }

  static address(programId: PublicKey) {
    return emitterAddress(programId);
  }
}
