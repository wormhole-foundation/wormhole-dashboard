import { PublicKey } from '@solana/web3.js';

export class RemoteTokenMessenger {
  domain: number;
  tokenMessenger: Array<number>;

  constructor(domain: number, tokenMessenger: Array<number>) {
    this.domain = domain;
    this.tokenMessenger = tokenMessenger;
  }

  static address(programId: PublicKey, remoteDomain: number) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('remote_token_messenger'), Buffer.from(remoteDomain.toString())],
      programId
    )[0];
  }
}
