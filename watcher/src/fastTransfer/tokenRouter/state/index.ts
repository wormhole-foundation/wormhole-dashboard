export * from './Custodian';
export * from './PreparedFill';
export * from './PreparedOrder';

import { solana } from '@certusone/wormhole-sdk';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export function deriveCoreMessageKey(programId: PublicKey, payer: PublicKey, sequence: BN) {
  return solana.deriveAddress(
    [Buffer.from('msg'), payer.toBuffer(), sequence.toBuffer()],
    programId
  );
}
