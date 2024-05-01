import { Program } from 'anchor-0.29.0';
import { Connection, PublicKey } from '@solana/web3.js';
import { MessageTransmitterProgram } from '../messageTransmitter';
import { IDL, TokenMessengerMinter } from '../types/token_messenger_minter';
import { RemoteTokenMessenger } from './RemoteTokenMessenger';

export const PROGRAM_IDS = ['CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3'] as const;

export type ProgramId = typeof PROGRAM_IDS[number];

export type DepositForBurnWithCallerAccounts = {
  senderAuthority: PublicKey;
  messageTransmitterConfig: PublicKey;
  tokenMessenger: PublicKey;
  remoteTokenMessenger: PublicKey;
  tokenMinter: PublicKey;
  localToken: PublicKey;
  tokenMessengerMinterEventAuthority: PublicKey;
  messageTransmitterProgram: PublicKey;
  tokenMessengerMinterProgram: PublicKey;
};

export class TokenMessengerMinterProgram {
  private _programId: ProgramId;

  program: Program<TokenMessengerMinter>;

  constructor(connection: Connection, programId?: ProgramId) {
    this._programId = programId ?? testnet();
    this.program = new Program(IDL, new PublicKey(this._programId), {
      connection,
    });
  }

  get ID(): PublicKey {
    return this.program.programId;
  }

  tokenMessengerAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('token_messenger')], this.ID)[0];
  }

  tokenMinterAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('token_minter')], this.ID)[0];
  }

  custodyTokenAddress(mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('custody'), mint.toBuffer()], this.ID)[0];
  }

  tokenPairAddress(remoteDomain: number, remoteTokenAddress: Array<number>): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('token_pair'),
        Buffer.from(remoteDomain.toString()),
        Buffer.from(remoteTokenAddress),
      ],
      this.ID
    )[0];
  }

  remoteTokenMessengerAddress(remoteDomain: number): PublicKey {
    return RemoteTokenMessenger.address(this.ID, remoteDomain);
  }

  async fetchRemoteTokenMessenger(addr: PublicKey): Promise<RemoteTokenMessenger> {
    const { domain, tokenMessenger } = await this.program.account.remoteTokenMessenger.fetch(addr);
    return new RemoteTokenMessenger(domain, Array.from(tokenMessenger.toBuffer()));
  }

  localTokenAddress(mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('local_token'), mint.toBuffer()],
      this.ID
    )[0];
  }

  senderAuthorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('sender_authority')], this.ID)[0];
  }

  eventAuthorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], this.ID)[0];
  }

  messageTransmitterProgram(): MessageTransmitterProgram {
    switch (this._programId) {
      case testnet(): {
        return new MessageTransmitterProgram(
          this.program.provider.connection,
          'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd'
        );
      }
      case mainnet(): {
        return new MessageTransmitterProgram(
          this.program.provider.connection,
          'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd'
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }

  depositForBurnWithCallerAccounts(
    mint: PublicKey,
    remoteDomain: number
  ): DepositForBurnWithCallerAccounts {
    const messageTransmitterProgram = this.messageTransmitterProgram();
    return {
      senderAuthority: this.senderAuthorityAddress(),
      messageTransmitterConfig: messageTransmitterProgram.messageTransmitterConfigAddress(),
      tokenMessenger: this.tokenMessengerAddress(),
      remoteTokenMessenger: this.remoteTokenMessengerAddress(remoteDomain),
      tokenMinter: this.tokenMinterAddress(),
      localToken: this.localTokenAddress(mint),
      tokenMessengerMinterEventAuthority: this.eventAuthorityAddress(),
      messageTransmitterProgram: messageTransmitterProgram.ID,
      tokenMessengerMinterProgram: this.ID,
    };
  }
}

export function mainnet(): ProgramId {
  return 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3';
}

export function testnet(): ProgramId {
  return 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3';
}
