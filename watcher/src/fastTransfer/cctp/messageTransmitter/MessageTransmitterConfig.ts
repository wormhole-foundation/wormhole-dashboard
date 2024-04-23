import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export class MessageTransmitterConfig {
  owner: PublicKey;
  pendingOwner: PublicKey;
  attesterManager: PublicKey;
  pauser: PublicKey;
  paused: boolean;
  localDomain: number;
  version: number;
  signatureThreshold: number;
  enabledAttesters: Array<PublicKey>;
  maxMessageBodySize: BN;
  nextAvailableNonce: BN;

  constructor(
    owner: PublicKey,
    pendingOwner: PublicKey,
    attesterManager: PublicKey,
    pauser: PublicKey,
    paused: boolean,
    localDomain: number,
    version: number,
    signatureThreshold: number,
    enabledAttesters: Array<PublicKey>,
    maxMessageBodySize: BN,
    nextAvailableNonce: BN
  ) {
    this.owner = owner;
    this.pendingOwner = pendingOwner;
    this.attesterManager = attesterManager;
    this.pauser = pauser;
    this.paused = paused;
    this.localDomain = localDomain;
    this.version = version;
    this.signatureThreshold = signatureThreshold;
    this.enabledAttesters = enabledAttesters;
    this.maxMessageBodySize = maxMessageBodySize;
    this.nextAvailableNonce = nextAvailableNonce;
  }

  static address(programId: PublicKey) {
    return PublicKey.findProgramAddressSync([Buffer.from('message_transmitter')], programId)[0];
  }
}
