import { BorshCoder, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import IDL from '../idls/ntt_quoter.json';
import { NttQuoter as Idl } from '../types/ntt_quoter';
import { U64, derivePda } from '../utils/solana';

//constants that must match ntt-quoter lib.rs / implementation:
const GWEI_PER_ETH = 1e9;
const SEED_PREFIX_INSTANCE = 'instance';
const SEED_PREFIX_RELAY_REQUEST = 'relay_request';

export class NttQuoter {
  readonly instance: PublicKey;
  private readonly program: Program<Idl>;
  readonly borsh: BorshCoder;

  constructor(connection: Connection, programId: PublicKeyInitData) {
    this.program = new Program<Idl>(IDL as Idl, new PublicKey(programId), { connection });
    this.instance = derivePda([SEED_PREFIX_INSTANCE], this.program.programId);
    this.borsh = new BorshCoder(IDL as any);
  }

  // ---- admin/assistant (=authority) relevant functions ----

  //  returns null if no relay was requested, otherwise it the requested gas dropoff (in eth),
  //  which can be 0, so a strict === null check is required!
  async wasRelayRequested(outboxItem: PublicKey) {
    const relayRequest = await this.program.account.relayRequest.fetchNullable(
      this.relayRequestPda(outboxItem)
    );

    return relayRequest ? U64.from(relayRequest.requestedGasDropoff, GWEI_PER_ETH) : null;
  }

  private relayRequestPda(outboxItem: PublicKey) {
    return derivePda([SEED_PREFIX_RELAY_REQUEST, outboxItem.toBytes()], this.program.programId);
  }
}
