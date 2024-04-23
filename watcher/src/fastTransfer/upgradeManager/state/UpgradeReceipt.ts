import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export type UpgradeStatus = {
  none?: {};
  uncommitted?: {
    buffer: PublicKey;
    slot: BN;
  };
};

export class UpgradeReceipt {
  bump: number;
  programDataBump: number;
  owner: PublicKey;
  status: UpgradeStatus;

  constructor(bump: number, programDataBump: number, owner: PublicKey, status: UpgradeStatus) {
    this.bump = bump;
    this.programDataBump = programDataBump;
    this.owner = owner;
    this.status = status;
  }

  static address(programId: PublicKey, otherProgram: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('receipt'), otherProgram.toBuffer()],
      programId
    )[0];
  }
}
