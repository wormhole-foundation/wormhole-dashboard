export * from './state';

import { Program } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import IDL from '../../idls/upgrade_manager.json';
import { UpgradeManager } from '../../types/upgrade_manager';
import * as matchingEngineSdk from '../matchingEngine';
import * as tokenRouterSdk from '../tokenRouter';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, programDataAddress } from '../utils';
import { UpgradeReceipt } from './state';

export const PROGRAM_IDS = [
  'UpgradeManager11111111111111111111111111111',
  'ucdP9ktgrXgEUnn6roqD2SfdGMR2JSiWHUKv23oXwxt',
] as const;

export type ProgramId = typeof PROGRAM_IDS[number];

export class UpgradeManagerProgram {
  private _programId: ProgramId;

  program: Program<UpgradeManager>;

  constructor(connection: Connection, programId: ProgramId) {
    this._programId = programId;
    this.program = new Program(
      { ...(IDL as any), address: this._programId },
      {
        connection,
      }
    );
  }

  get ID(): PublicKey {
    return this.program.programId;
  }

  upgradeAuthorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('upgrade')], this.ID)[0];
  }

  upgradeReceiptAddress(otherProgram: PublicKey): PublicKey {
    return UpgradeReceipt.address(this.ID, otherProgram);
  }

  async fetchUpgradeReceipt(input: PublicKey | { address: PublicKey }): Promise<UpgradeReceipt> {
    const addr = 'address' in input ? input.address : this.upgradeReceiptAddress(input);
    return this.program.account.upgradeReceipt.fetch(addr);
  }

  ownerOnlyComposite(owner: PublicKey): {
    owner: PublicKey;
    upgradeAuthority: PublicKey;
  } {
    return { owner, upgradeAuthority: this.upgradeAuthorityAddress() };
  }

  requiredSysvarsComposite(): {
    rent: PublicKey;
    clock: PublicKey;
  } {
    return {
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    };
  }

  executeUpgradeComposite(accounts: {
    owner: PublicKey;
    program: PublicKey;
    buffer: PublicKey;
    payer?: PublicKey;
  }) {
    const { owner, program, buffer, payer: inputPayer } = accounts;
    return {
      payer: inputPayer ?? owner,
      admin: this.ownerOnlyComposite(owner),
      receipt: this.upgradeReceiptAddress(program),
      buffer,
      programData: programDataAddress(program),
      program,
      bpfLoaderUpgradeableProgram: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      sysvars: this.requiredSysvarsComposite(),
    };
  }

  commitUpgradeComposite(accounts: {
    owner: PublicKey;
    program: PublicKey;
    recipient?: PublicKey;
  }) {
    const { owner, program, recipient: inputRecipient } = accounts;
    return {
      admin: this.ownerOnlyComposite(owner),
      recipient: inputRecipient ?? owner,
      receipt: this.upgradeReceiptAddress(program),
      programData: programDataAddress(program),
      program,
    };
  }

  async executeMatchingEngineUpgradeIx(accounts: {
    owner: PublicKey;
    matchingEngineBuffer: PublicKey;
    payer?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, matchingEngineBuffer, payer } = accounts;

    const matchingEngine = this.matchingEngineProgram();
    return this.program.methods
      .executeMatchingEngineUpgrade()
      .accounts({
        matchingEngineCustodian: matchingEngine.custodianAddress(),
        executeUpgrade: this.executeUpgradeComposite({
          owner,
          program: matchingEngine.ID,
          buffer: matchingEngineBuffer,
          payer,
        }),
      })
      .instruction();
  }

  async commitMatchingEngineUpgradeIx(accounts: {
    owner: PublicKey;
    recipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, recipient } = accounts;
    const matchingEngine = this.matchingEngineProgram();

    return this.program.methods
      .commitMatchingEngineUpgrade()
      .accounts({
        matchingEngineCustodian: matchingEngine.custodianAddress(),
        commitUpgrade: this.commitUpgradeComposite({
          owner,
          program: matchingEngine.ID,
          recipient,
        }),
      })
      .instruction();
  }

  async executeTokenRouterUpgradeIx(accounts: {
    owner: PublicKey;
    tokenRouterBuffer: PublicKey;
    payer?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, tokenRouterBuffer, payer } = accounts;

    const tokenRouter = this.tokenRouterProgram();
    return this.program.methods
      .executeTokenRouterUpgrade()
      .accounts({
        tokenRouterCustodian: tokenRouter.custodianAddress(),
        executeUpgrade: this.executeUpgradeComposite({
          owner,
          program: tokenRouter.ID,
          buffer: tokenRouterBuffer,
          payer,
        }),
      })
      .instruction();
  }

  async commitTokenRouterUpgradeIx(accounts: {
    owner: PublicKey;
    recipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, recipient } = accounts;
    const tokenRouter = this.tokenRouterProgram();

    return this.program.methods
      .commitTokenRouterUpgrade()
      .accounts({
        tokenRouterCustodian: tokenRouter.custodianAddress(),
        commitUpgrade: this.commitUpgradeComposite({
          owner,
          program: tokenRouter.ID,
          recipient,
        }),
      })
      .instruction();
  }

  matchingEngineProgram(): matchingEngineSdk.MatchingEngineProgram {
    switch (this._programId) {
      case testnet(): {
        return new matchingEngineSdk.MatchingEngineProgram(
          this.program.provider.connection,
          matchingEngineSdk.testnet(),
          PublicKey.default
        );
      }
      case localnet(): {
        return new matchingEngineSdk.MatchingEngineProgram(
          this.program.provider.connection,
          matchingEngineSdk.localnet(),
          PublicKey.default
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }

  tokenRouterProgram(): tokenRouterSdk.TokenRouterProgram {
    switch (this._programId) {
      case testnet(): {
        return new tokenRouterSdk.TokenRouterProgram(
          this.program.provider.connection,
          tokenRouterSdk.testnet(),
          PublicKey.default
        );
      }
      case localnet(): {
        return new tokenRouterSdk.TokenRouterProgram(
          this.program.provider.connection,
          tokenRouterSdk.localnet(),
          PublicKey.default
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }
}

export function testnet(): ProgramId {
  return 'ucdP9ktgrXgEUnn6roqD2SfdGMR2JSiWHUKv23oXwxt';
}

export function localnet(): ProgramId {
  return 'UpgradeManager11111111111111111111111111111';
}
