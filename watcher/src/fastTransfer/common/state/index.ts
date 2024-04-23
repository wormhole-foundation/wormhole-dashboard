import { PublicKey } from '@solana/web3.js';
import { Uint64, writeUint64BE } from '..';

export function emitterAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('emitter')], programId)[0];
}

export function coreMessageAddress(programId: PublicKey, associatedAccount: PublicKey): PublicKey {
  return messageAddress(programId, associatedAccount, 'core-msg');
}

export function cctpMessageAddress(programId: PublicKey, associatedAccount: PublicKey): PublicKey {
  return messageAddress(programId, associatedAccount, 'cctp-msg');
}

function messageAddress(
  programId: PublicKey,
  associatedAccount: PublicKey,
  prefix: string
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(prefix), associatedAccount.toBuffer()],
    programId
  )[0];
}

export function coreMessageAddressOld(
  programId: PublicKey,
  payer: PublicKey,
  payerSequenceValue: Uint64
): PublicKey {
  return messageAddressOld(programId, payer, payerSequenceValue, 'core-msg');
}

export function cctpMessageAddressOld(
  programId: PublicKey,
  payer: PublicKey,
  payerSequenceValue: Uint64
): PublicKey {
  return messageAddressOld(programId, payer, payerSequenceValue, 'cctp-msg');
}

function messageAddressOld(
  programId: PublicKey,
  payer: PublicKey,
  payerSequenceValue: Uint64,
  prefix: string
): PublicKey {
  const encodedPayerSequenceValue = Buffer.alloc(8);
  writeUint64BE(encodedPayerSequenceValue, payerSequenceValue);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(prefix), payer.toBuffer(), encodedPayerSequenceValue],
    programId
  )[0];
}
