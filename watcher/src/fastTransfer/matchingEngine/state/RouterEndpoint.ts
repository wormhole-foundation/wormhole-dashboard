import { PublicKey } from '@solana/web3.js';

export type MessageProtocol = {
  local?: { programId: PublicKey };
  cctp?: { domain: number };
  none?: {};
};

export class RouterEndpoint {
  bump: number;
  chain: number;
  address: Array<number>;
  mintRecipient: Array<number>;
  protocol: MessageProtocol;

  constructor(
    bump: number,
    chain: number,
    address: Array<number>,
    mintRecipient: Array<number>,
    protocol: MessageProtocol
  ) {
    this.bump = bump;
    this.chain = chain;
    this.address = address;
    this.mintRecipient = mintRecipient;
    this.protocol = protocol;
  }

  static address(programId: PublicKey, chain: number) {
    const encodedChain = Buffer.alloc(2);
    encodedChain.writeUInt16BE(chain);
    return PublicKey.findProgramAddressSync([Buffer.from('endpoint'), encodedChain], programId)[0];
  }
}
