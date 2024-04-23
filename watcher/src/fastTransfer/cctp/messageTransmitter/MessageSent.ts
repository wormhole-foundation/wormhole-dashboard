import { PublicKey } from '@solana/web3.js';

export class MessageSent {
  rentPayer: PublicKey;
  message: Buffer;

  constructor(rentPayer: PublicKey, message: Buffer) {
    this.rentPayer = rentPayer;
    this.message = message;
  }
}
