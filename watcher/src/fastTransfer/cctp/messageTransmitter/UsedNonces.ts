import { PublicKey } from '@solana/web3.js';

export const MAX_NONCES = 6400n;

export class UsedNonses {
  static address(programId: PublicKey, remoteDomain: number, nonce: bigint) {
    const firstNonce = ((nonce - 1n) / MAX_NONCES) * MAX_NONCES + 1n;
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('used_nonces'),
        Buffer.from(remoteDomain.toString()),
        Buffer.from(firstNonce.toString()),
      ],
      programId
    )[0];
  }
}
