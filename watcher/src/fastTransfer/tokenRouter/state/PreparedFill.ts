import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export type FillType = {
  unset?: {};
  wormholeCctpDeposit?: {};
  fastFill?: {};
};

export type PreparedFillInfo = {
  vaaHash: Array<number>;
  bump: number;
  preparedCustodyTokenBump: number;
  preparedBy: PublicKey;
  fillType: FillType;
  sourceChain: number;
  orderSender: Array<number>;
  redeemer: PublicKey;
};

export class PreparedFill {
  info: PreparedFillInfo;
  redeemerMessage: Buffer;

  constructor(info: PreparedFillInfo, redeemerMessage: Buffer) {
    this.info = info;
    this.redeemerMessage = redeemerMessage;
  }

  static address(programId: PublicKey, vaaHash: Array<number> | Uint8Array | Buffer) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('fill'), Buffer.from(vaaHash)],
      programId
    )[0];
  }
}
