import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { VaaHash } from '../../common';
export class PreparedOrderResponse {
  bump: number;
  preparedBy: PublicKey;
  fastVaaHash: Array<number>;
  sourceChain: number;
  baseFee: BN;

  constructor(
    bump: number,
    preparedBy: PublicKey,
    fastVaaHash: Array<number>,
    sourceChain: number,
    baseFee: BN
  ) {
    this.bump = bump;
    this.preparedBy = preparedBy;
    this.fastVaaHash = fastVaaHash;
    this.sourceChain = sourceChain;
    this.baseFee = baseFee;
  }

  static address(programId: PublicKey, fastVaaHash: VaaHash) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('order-response'), Buffer.from(fastVaaHash)],
      programId
    )[0];
  }
}
