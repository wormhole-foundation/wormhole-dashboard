import { PublicKey } from '@solana/web3.js';
import { isPublicKey } from '../../utils';

export type MessageProtocol = {
  local?: { programId: PublicKey };
  cctp?: { domain: number };
  none?: {};
};

export function isMessageProtocol(thing: any): thing is MessageProtocol {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    (thing.local === null || (thing.local && isPublicKey(thing.local.programId))) &&
    (thing.cctp === null || (thing.cctp && typeof thing.cctp.domain === 'number')) &&
    thing.none === null
  );
}

export type EndpointInfo = {
  chain: number;
  address: Array<number>;
  mintRecipient: Array<number>;
  protocol: MessageProtocol;
};

export class RouterEndpoint {
  bump: number;
  info: EndpointInfo;

  constructor(bump: number, info: EndpointInfo) {
    this.bump = bump;
    this.info = info;
  }

  static address(programId: PublicKey, chain: number) {
    const encodedChain = Buffer.alloc(2);
    encodedChain.writeUInt16BE(chain);
    return PublicKey.findProgramAddressSync([Buffer.from('endpoint'), encodedChain], programId)[0];
  }
}
