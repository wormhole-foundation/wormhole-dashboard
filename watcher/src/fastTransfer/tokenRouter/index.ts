export * from './state';

import * as wormholeSdk from '@certusone/wormhole-sdk';
import { Program } from '@coral-xyz/anchor';
import * as splToken from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Keccak } from 'sha3';
import { IDL, TokenRouter } from '../../types/token_router';
import {
  CctpTokenBurnMessage,
  MessageTransmitterProgram,
  TokenMessengerMinterProgram,
} from '../cctp';
import {
  cctpMessageAddress,
  coreMessageAddress,
  reclaimCctpMessageIx,
  uint64ToBN,
} from '../common';
import * as matchingEngineSdk from '../matchingEngine';
import { UpgradeManagerProgram } from '../upgradeManager';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, programDataAddress } from '../utils';
import { VaaAccount } from '../wormhole';
import { Custodian, PreparedFill, PreparedOrder } from './state';

export const PROGRAM_IDS = [
  'TokenRouter11111111111111111111111111111111',
  'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
] as const;

export type ProgramId = typeof PROGRAM_IDS[number];

export type PrepareMarketOrderArgs = {
  amountIn: bigint;
  minAmountOut: bigint | null;
  targetChain: number;
  redeemer: Array<number>;
  redeemerMessage: Buffer;
};

export type PublishMessageAccounts = {
  coreBridgeConfig: PublicKey;
  coreEmitterSequence: PublicKey;
  coreFeeCollector: PublicKey;
  coreBridgeProgram: PublicKey;
};

export type TokenRouterCommonAccounts = PublishMessageAccounts & {
  tokenRouterProgram: PublicKey;
  systemProgram: PublicKey;
  rent: PublicKey;
  clock: PublicKey;
  custodian: PublicKey;
  cctpMintRecipient: PublicKey;
  tokenMessenger: PublicKey;
  tokenMinter: PublicKey;
  tokenMessengerMinterSenderAuthority: PublicKey;
  tokenMessengerMinterProgram: PublicKey;
  messageTransmitterAuthority: PublicKey;
  messageTransmitterConfig: PublicKey;
  messageTransmitterProgram: PublicKey;
  tokenProgram: PublicKey;
  mint: PublicKey;
  localToken: PublicKey;
  tokenMessengerMinterCustodyToken: PublicKey;
  matchingEngineProgram: PublicKey;
  matchingEngineCustodian: PublicKey;
  matchingEngineCctpMintRecipient: PublicKey;
};

export type RedeemFillCctpAccounts = {
  custodian: PublicKey;
  preparedFill: PublicKey;
  cctpMintRecipient: PublicKey;
  routerEndpoint: PublicKey;
  messageTransmitterAuthority: PublicKey;
  messageTransmitterConfig: PublicKey;
  usedNonces: PublicKey;
  messageTransmitterEventAuthority: PublicKey;
  tokenMessenger: PublicKey;
  remoteTokenMessenger: PublicKey;
  tokenMinter: PublicKey;
  localToken: PublicKey;
  tokenPair: PublicKey;
  tokenMessengerMinterCustodyToken: PublicKey;
  tokenMessengerMinterProgram: PublicKey;
  messageTransmitterProgram: PublicKey;
  tokenMessengerMinterEventAuthority: PublicKey;
};

export type RedeemFastFillAccounts = {
  custodian: PublicKey;
  preparedFill: PublicKey;
  cctpMintRecipient: PublicKey;
  matchingEngineCustodian: PublicKey;
  matchingEngineRedeemedFastFill: PublicKey;
  matchingEngineFromEndpoint: PublicKey;
  matchingEngineToEndpoint: PublicKey;
  matchingEngineLocalCustodyToken: PublicKey;
  matchingEngineProgram: PublicKey;
};

export type AddCctpRouterEndpointArgs = {
  chain: number;
  cctpDomain: number;
  address: Array<number>;
  mintRecipient: Array<number> | null;
};

export class TokenRouterProgram {
  private _programId: ProgramId;
  private _mint: PublicKey;

  program: Program<TokenRouter>;

  // TODO: fix this
  constructor(connection: Connection, programId: ProgramId, mint: PublicKey) {
    this._programId = programId;
    this._mint = mint;
    this.program = new Program(IDL, new PublicKey(this._programId), {
      connection,
    });
  }

  get ID(): PublicKey {
    return this.program.programId;
  }

  get mint(): PublicKey {
    return this._mint;
  }

  custodianAddress(): PublicKey {
    return Custodian.address(this.ID);
  }

  async fetchCustodian(input?: { address: PublicKey }): Promise<Custodian> {
    const addr = input === undefined ? this.custodianAddress() : input.address;
    return this.program.account.custodian.fetch(addr);
  }

  cctpMintRecipientAddress(): PublicKey {
    return splToken.getAssociatedTokenAddressSync(this.mint, this.custodianAddress(), true);
  }

  preparedCustodyTokenAddress(preparedAccount: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('prepared-custody'), preparedAccount.toBuffer()],
      this.ID
    )[0];
  }

  coreMessageAddress(preparedOrder: PublicKey): PublicKey {
    return coreMessageAddress(this.ID, preparedOrder);
  }

  cctpMessageAddress(preparedOrder: PublicKey): PublicKey {
    return cctpMessageAddress(this.ID, preparedOrder);
  }

  async reclaimCctpMessageIx(
    accounts: {
      payer: PublicKey;
      cctpMessage: PublicKey;
    },
    cctpAttestation: Buffer
  ): Promise<TransactionInstruction> {
    return reclaimCctpMessageIx(this.messageTransmitterProgram(), accounts, cctpAttestation);
  }

  async fetchPreparedOrder(addr: PublicKey): Promise<PreparedOrder> {
    return this.program.account.preparedOrder.fetch(addr);
  }

  preparedFillAddress(vaaHash: Array<number> | Uint8Array | Buffer) {
    return PreparedFill.address(this.ID, vaaHash);
  }

  // TODO: fix
  async fetchPreparedFill(addr: PublicKey): Promise<PreparedFill> {
    return this.program.account.preparedFill.fetch(addr);
  }

  transferAuthorityAddress(preparedOrder: PublicKey, args: PrepareMarketOrderArgs): PublicKey {
    const { amountIn, minAmountOut, targetChain, redeemer, redeemerMessage } = args;
    const hasher = new Keccak(256);
    hasher.update(uint64ToBN(amountIn).toBuffer('be', 8));
    if (minAmountOut !== null) {
      hasher.update(uint64ToBN(minAmountOut).toBuffer('be', 8));
    }
    hasher.update(
      (() => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(targetChain);
        return buf;
      })()
    );
    hasher.update(Buffer.from(redeemer));
    hasher.update(redeemerMessage);

    return PublicKey.findProgramAddressSync(
      [Buffer.from('transfer-authority'), preparedOrder.toBuffer(), hasher.digest()],
      this.ID
    )[0];
  }

  async commonAccounts(): Promise<TokenRouterCommonAccounts> {
    const custodian = this.custodianAddress();
    const { coreBridgeConfig, coreEmitterSequence, coreFeeCollector, coreBridgeProgram } =
      this.publishMessageAccounts(custodian);

    const tokenMessengerMinterProgram = this.tokenMessengerMinterProgram();
    const messageTransmitterProgram = this.messageTransmitterProgram();

    const cctpMintRecipient = this.cctpMintRecipientAddress();
    const mint = this.mint;

    const matchingEngine = this.matchingEngineProgram();

    return {
      tokenRouterProgram: this.ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
      custodian,
      cctpMintRecipient,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
      tokenMessenger: tokenMessengerMinterProgram.tokenMessengerAddress(),
      tokenMinter: tokenMessengerMinterProgram.tokenMinterAddress(),
      tokenMessengerMinterSenderAuthority: tokenMessengerMinterProgram.senderAuthorityAddress(),
      tokenMessengerMinterProgram: tokenMessengerMinterProgram.ID,
      messageTransmitterAuthority: messageTransmitterProgram.authorityAddress(
        tokenMessengerMinterProgram.ID
      ),
      messageTransmitterConfig: messageTransmitterProgram.messageTransmitterConfigAddress(),
      messageTransmitterProgram: messageTransmitterProgram.ID,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      mint,
      localToken: tokenMessengerMinterProgram.localTokenAddress(mint),
      tokenMessengerMinterCustodyToken: tokenMessengerMinterProgram.custodyTokenAddress(mint),
      matchingEngineProgram: matchingEngine.ID,
      matchingEngineCustodian: matchingEngine.custodianAddress(),
      matchingEngineCctpMintRecipient: matchingEngine.cctpMintRecipientAddress(),
    };
  }

  checkedCustodianComposite(addr?: PublicKey): { custodian: PublicKey } {
    return { custodian: addr ?? this.custodianAddress() };
  }

  adminComposite(
    ownerOrAssistant: PublicKey,
    custodian?: PublicKey
  ): { ownerOrAssistant: PublicKey; custodian: { custodian: PublicKey } } {
    return { ownerOrAssistant, custodian: this.checkedCustodianComposite(custodian) };
  }

  adminMutComposite(
    ownerOrAssistant: PublicKey,
    custodian?: PublicKey
  ): { ownerOrAssistant: PublicKey; custodian: PublicKey } {
    return { ownerOrAssistant, custodian: custodian ?? this.custodianAddress() };
  }

  ownerOnlyComposite(
    owner: PublicKey,
    custodian?: PublicKey
  ): { owner: PublicKey; custodian: { custodian: PublicKey } } {
    return { owner, custodian: this.checkedCustodianComposite(custodian) };
  }

  ownerOnlyMutComposite(
    owner: PublicKey,
    custodian?: PublicKey
  ): { owner: PublicKey; custodian: PublicKey } {
    return { owner, custodian: custodian ?? this.custodianAddress() };
  }

  liquidityLayerVaaComposite(vaa: PublicKey): { vaa: PublicKey } {
    return {
      vaa,
    };
  }

  usdcComposite(mint?: PublicKey): { mint: PublicKey } {
    return {
      mint: mint ?? this.mint,
    };
  }

  initIfNeededPreparedFillComposite(accounts: {
    payer: PublicKey;
    vaa: PublicKey;
    preparedFill: PublicKey;
  }) {
    const { payer, vaa, preparedFill } = accounts;
    return {
      payer,
      fillVaa: this.liquidityLayerVaaComposite(vaa),
      preparedFill,
      custodyToken: this.preparedCustodyTokenAddress(preparedFill),
      usdc: this.usdcComposite(),
    };
  }

  async approveTransferAuthorityIx(
    accounts: {
      preparedOrder: PublicKey;
      senderToken: PublicKey;
      sender?: PublicKey;
    },
    args: PrepareMarketOrderArgs
  ): Promise<{ transferAuthority: PublicKey; ix: TransactionInstruction }> {
    const { preparedOrder, senderToken } = accounts;
    const { amountIn } = args;

    let { sender } = accounts;
    sender ??= await (async () => {
      const tokenAccount = await splToken.getAccount(this.program.provider.connection, senderToken);
      return tokenAccount.owner;
    })();

    const transferAuthority = this.transferAuthorityAddress(preparedOrder, args);

    return {
      transferAuthority,
      ix: splToken.createApproveInstruction(senderToken, transferAuthority, sender, amountIn),
    };
  }

  async prepareMarketOrderIx(
    accounts: {
      payer: PublicKey;
      preparedOrder: PublicKey;
      senderToken: PublicKey;
      refundToken?: PublicKey;
      sender?: PublicKey;
    },
    args: PrepareMarketOrderArgs
  ): Promise<[approveIx: TransactionInstruction, prepareIx: TransactionInstruction]> {
    const { payer, preparedOrder, senderToken, sender } = accounts;
    let { refundToken } = accounts;
    refundToken ??= senderToken;

    const { transferAuthority, ix: approveIx } = await this.approveTransferAuthorityIx(
      { preparedOrder, senderToken, sender },
      args
    );

    const prepareIx = await this.program.methods
      .prepareMarketOrder({
        ...args,
        amountIn: uint64ToBN(args.amountIn),
        minAmountOut: args.minAmountOut === null ? null : uint64ToBN(args.minAmountOut),
      })
      .accounts({
        payer,
        custodian: this.checkedCustodianComposite(),
        transferAuthority,
        preparedOrder,
        senderToken,
        refundToken,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedOrder),
        usdc: this.usdcComposite(),
      })
      .instruction();

    return [approveIx, prepareIx];
  }

  async closePreparedOrderIx(accounts: {
    preparedOrder: PublicKey;
    preparedBy?: PublicKey;
    orderSender?: PublicKey;
    refundToken?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { preparedOrder } = accounts;
    let { preparedBy, orderSender, refundToken } = accounts;

    if (preparedBy === undefined || orderSender === undefined || refundToken === undefined) {
      const { info } = await this.fetchPreparedOrder(preparedOrder);

      preparedBy ??= info.preparedBy;
      orderSender ??= info.orderSender;
      refundToken ??= info.refundToken;
    }

    return this.program.methods
      .closePreparedOrder()
      .accounts({
        preparedBy,
        custodian: this.checkedCustodianComposite(),
        orderSender,
        preparedOrder,
        refundToken,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedOrder),
      })
      .instruction();
  }

  async consumePreparedFillIx(accounts: {
    preparedFill: PublicKey;
    redeemer: PublicKey;
    dstToken: PublicKey;
    beneficiary: PublicKey;
  }): Promise<TransactionInstruction> {
    const { preparedFill, redeemer, dstToken, beneficiary } = accounts;

    return this.program.methods
      .consumePreparedFill()
      .accounts({
        redeemer,
        beneficiary,
        preparedFill,
        dstToken,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedFill),
      })
      .instruction();
  }

  async placeMarketOrderCctpIx(
    accounts: {
      payer: PublicKey;
      preparedOrder: PublicKey;
      preparedBy?: PublicKey;
      routerEndpoint?: PublicKey;
    },
    args: {
      targetChain?: wormholeSdk.ChainId;
      destinationDomain?: number;
    } = {}
  ): Promise<TransactionInstruction> {
    const { payer, preparedOrder } = accounts;
    let { preparedBy, routerEndpoint } = accounts;
    let { targetChain, destinationDomain } = args;

    if (preparedBy === undefined || targetChain === undefined) {
      const { info } = await this.fetchPreparedOrder(preparedOrder).catch((_) => {
        throw new Error('Cannot find prepared order');
      });

      preparedBy ??= info.preparedBy;

      if (!wormholeSdk.isChain(info.targetChain)) {
        throw new Error('Invalid chain found in prepared order');
      }
      targetChain ??= info.targetChain;
    }

    const matchingEngine = this.matchingEngineProgram();
    routerEndpoint ??= matchingEngine.routerEndpointAddress(targetChain);

    const coreMessage = this.coreMessageAddress(preparedOrder);
    const cctpMessage = this.cctpMessageAddress(preparedOrder);

    if (destinationDomain === undefined) {
      const { protocol } = await matchingEngine.fetchRouterEndpoint({
        address: routerEndpoint,
      });
      if (protocol.cctp === undefined) {
        throw new Error('invalid router endpoint');
      }
      destinationDomain = protocol.cctp.domain;
    }

    const {
      senderAuthority: tokenMessengerMinterSenderAuthority,
      messageTransmitterConfig,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenMessengerMinterEventAuthority,
      messageTransmitterProgram,
      tokenMessengerMinterProgram,
    } = this.tokenMessengerMinterProgram().depositForBurnWithCallerAccounts(
      this.mint,
      destinationDomain
    );

    const custodian = this.custodianAddress();
    const { coreBridgeConfig, coreEmitterSequence, coreFeeCollector, coreBridgeProgram } =
      this.publishMessageAccounts(custodian);

    return this.program.methods
      .placeMarketOrderCctp()
      .accounts({
        payer,
        preparedBy,
        custodian: this.checkedCustodianComposite(),
        preparedOrder,
        mint: this.mint,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedOrder),
        routerEndpoint,
        coreBridgeConfig,
        coreMessage,
        cctpMessage,
        coreEmitterSequence,
        coreFeeCollector,
        tokenMessengerMinterSenderAuthority,
        messageTransmitterConfig,
        tokenMessenger,
        remoteTokenMessenger,
        tokenMinter,
        localToken,
        tokenMessengerMinterEventAuthority,
        coreBridgeProgram,
        tokenMessengerMinterProgram,
        messageTransmitterProgram,
      })
      .instruction();
  }

  async redeemCctpFillAccounts(
    vaa: PublicKey,
    cctpMessage: CctpTokenBurnMessage | Buffer
  ): Promise<RedeemFillCctpAccounts> {
    const msg = CctpTokenBurnMessage.from(cctpMessage);
    const cctpMintRecipient = this.cctpMintRecipientAddress();

    const vaaAccount = await VaaAccount.fetch(this.program.provider.connection, vaa);
    const { chain } = vaaAccount.emitterInfo();
    const preparedFill = this.preparedFillAddress(vaaAccount.digest());

    const {
      authority: messageTransmitterAuthority,
      messageTransmitterConfig,
      usedNonces,
      messageTransmitterEventAuthority,
      tokenMessengerMinterProgram,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenPair,
      custodyToken: tokenMessengerMinterCustodyToken,
      tokenMessengerMinterEventAuthority,
      messageTransmitterProgram,
    } = this.messageTransmitterProgram().receiveTokenMessengerMinterMessageAccounts(this.mint, msg);

    return {
      custodian: this.custodianAddress(),
      preparedFill,
      cctpMintRecipient,
      routerEndpoint: this.matchingEngineProgram().routerEndpointAddress(chain),
      messageTransmitterAuthority,
      messageTransmitterConfig,
      usedNonces,
      messageTransmitterEventAuthority,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenPair,
      tokenMessengerMinterCustodyToken,
      tokenMessengerMinterProgram,
      messageTransmitterProgram,
      tokenMessengerMinterEventAuthority,
    };
  }

  async redeemCctpFillIx(
    accounts: {
      payer: PublicKey;
      vaa: PublicKey;
      routerEndpoint?: PublicKey;
    },
    args: {
      encodedCctpMessage: Buffer;
      cctpAttestation: Buffer;
    }
  ): Promise<TransactionInstruction> {
    const { payer, vaa, routerEndpoint: inputRouterEndpoint } = accounts;

    const { encodedCctpMessage } = args;

    const {
      preparedFill,
      cctpMintRecipient,
      routerEndpoint,
      messageTransmitterAuthority,
      messageTransmitterConfig,
      usedNonces,
      messageTransmitterEventAuthority,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenPair,
      tokenMessengerMinterCustodyToken,
      tokenMessengerMinterProgram,
      messageTransmitterProgram,
      tokenMessengerMinterEventAuthority,
    } = await this.redeemCctpFillAccounts(vaa, encodedCctpMessage);

    return this.program.methods
      .redeemCctpFill(args)
      .accounts({
        custodian: this.checkedCustodianComposite(),
        preparedFill: this.initIfNeededPreparedFillComposite({
          payer,
          vaa,
          preparedFill,
        }),
        routerEndpoint: inputRouterEndpoint ?? routerEndpoint,
        cctp: {
          mintRecipient: { mintRecipient: cctpMintRecipient },
          messageTransmitterAuthority,
          messageTransmitterConfig,
          usedNonces,
          messageTransmitterEventAuthority,
          tokenMessenger,
          remoteTokenMessenger,
          tokenMinter,
          localToken,
          tokenPair,
          tokenMessengerMinterCustodyToken,
          tokenMessengerMinterEventAuthority,
          tokenMessengerMinterProgram,
          messageTransmitterProgram,
        },
      })
      .instruction();
  }

  async redeemFastFillAccounts(
    vaa: PublicKey,
    sourceChain?: wormholeSdk.ChainId
  ): Promise<RedeemFastFillAccounts> {
    const {
      vaaAccount,
      accounts: {
        custodian: matchingEngineCustodian,
        redeemedFastFill: matchingEngineRedeemedFastFill,
        fromRouterEndpoint: matchingEngineFromEndpoint,
        toRouterEndpoint: matchingEngineToEndpoint,
        localCustodyToken: matchingEngineLocalCustodyToken,
        matchingEngineProgram,
      },
    } = await this.matchingEngineProgram().redeemFastFillAccounts(vaa, sourceChain);

    return {
      custodian: this.custodianAddress(),
      preparedFill: this.preparedFillAddress(vaaAccount.digest()),
      cctpMintRecipient: this.cctpMintRecipientAddress(),
      matchingEngineCustodian,
      matchingEngineRedeemedFastFill,
      matchingEngineFromEndpoint,
      matchingEngineToEndpoint,
      matchingEngineLocalCustodyToken,
      matchingEngineProgram,
    };
  }
  async redeemFastFillIx(accounts: {
    payer: PublicKey;
    vaa: PublicKey;
  }): Promise<TransactionInstruction> {
    const { payer, vaa } = accounts;
    const {
      preparedFill,
      matchingEngineCustodian,
      matchingEngineRedeemedFastFill,
      matchingEngineFromEndpoint,
      matchingEngineToEndpoint,
      matchingEngineLocalCustodyToken,
      matchingEngineProgram,
    } = await this.redeemFastFillAccounts(vaa);

    return this.program.methods
      .redeemFastFill()
      .accounts({
        custodian: this.checkedCustodianComposite(),
        preparedFill: this.initIfNeededPreparedFillComposite({
          payer,
          vaa,
          preparedFill,
        }),
        matchingEngineCustodian,
        matchingEngineRedeemedFastFill,
        matchingEngineFromEndpoint,
        matchingEngineToEndpoint,
        matchingEngineLocalCustodyToken,
        matchingEngineProgram,
      })
      .instruction();
  }

  async initializeIx(accounts: {
    owner: PublicKey;
    ownerAssistant: PublicKey;
    mint?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, ownerAssistant, mint: inputMint } = accounts;

    const upgradeManager = this.upgradeManagerProgram();
    return this.program.methods
      .initialize()
      .accounts({
        owner,
        custodian: this.custodianAddress(),
        ownerAssistant,
        mint: inputMint ?? this.mint,
        cctpMintRecipient: this.cctpMintRecipientAddress(),
        programData: programDataAddress(this.ID),
        upgradeManagerAuthority: upgradeManager.upgradeAuthorityAddress(),
        upgradeManagerProgram: upgradeManager.ID,
        bpfLoaderUpgradeableProgram: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      })
      .instruction();
  }

  async setPauseIx(
    accounts: {
      ownerOrAssistant: PublicKey;
      custodian?: PublicKey;
    },
    paused: boolean
  ): Promise<TransactionInstruction> {
    const { ownerOrAssistant, custodian: inputCustodian } = accounts;
    return this.program.methods
      .setPause(paused)
      .accounts({
        admin: this.adminMutComposite(ownerOrAssistant, inputCustodian),
      })
      .instruction();
  }

  async submitOwnershipTransferIx(accounts: {
    owner: PublicKey;
    newOwner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, newOwner, custodian: inputCustodian } = accounts;
    return this.program.methods
      .submitOwnershipTransferRequest()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, inputCustodian),
        newOwner,
      })
      .instruction();
  }

  async confirmOwnershipTransferIx(accounts: {
    pendingOwner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { pendingOwner, custodian: inputCustodian } = accounts;
    return this.program.methods
      .confirmOwnershipTransferRequest()
      .accounts({
        pendingOwner,
        custodian: inputCustodian ?? this.custodianAddress(),
      })
      .instruction();
  }

  async cancelOwnershipTransferIx(accounts: {
    owner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, custodian: inputCustodian } = accounts;
    return this.program.methods
      .cancelOwnershipTransferRequest()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, inputCustodian),
      })
      .instruction();
  }

  async updateOwnerAssistantIx(accounts: {
    owner: PublicKey;
    newOwnerAssistant: PublicKey;
    custodian?: PublicKey;
  }) {
    const { owner, newOwnerAssistant, custodian: inputCustodian } = accounts;
    return this.program.methods
      .updateOwnerAssistant()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, inputCustodian),
        newOwnerAssistant,
      })
      .instruction();
  }

  publishMessageAccounts(emitter: PublicKey): PublishMessageAccounts {
    const coreBridgeProgram = this.coreBridgeProgramId();

    return {
      coreBridgeConfig: PublicKey.findProgramAddressSync(
        [Buffer.from('Bridge')],
        coreBridgeProgram
      )[0],
      coreEmitterSequence: PublicKey.findProgramAddressSync(
        [Buffer.from('Sequence'), emitter.toBuffer()],
        coreBridgeProgram
      )[0],
      coreFeeCollector: PublicKey.findProgramAddressSync(
        [Buffer.from('fee_collector')],
        coreBridgeProgram
      )[0],
      coreBridgeProgram,
    };
  }

  upgradeManagerProgram(): UpgradeManagerProgram {
    switch (this._programId) {
      case testnet(): {
        return new UpgradeManagerProgram(
          this.program.provider.connection,
          'ucdP9ktgrXgEUnn6roqD2SfdGMR2JSiWHUKv23oXwxt'
        );
      }
      case localnet(): {
        return new UpgradeManagerProgram(
          this.program.provider.connection,
          'UpgradeManager11111111111111111111111111111'
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }

  tokenMessengerMinterProgram(): TokenMessengerMinterProgram {
    switch (this._programId) {
      case testnet(): {
        return new TokenMessengerMinterProgram(
          this.program.provider.connection,
          'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3'
        );
      }
      case localnet(): {
        return new TokenMessengerMinterProgram(
          this.program.provider.connection,
          'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3'
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }

  messageTransmitterProgram(): MessageTransmitterProgram {
    switch (this._programId) {
      case testnet(): {
        return new MessageTransmitterProgram(
          this.program.provider.connection,
          'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd'
        );
      }
      case localnet(): {
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

  matchingEngineProgram(): matchingEngineSdk.MatchingEngineProgram {
    switch (this._programId) {
      case testnet(): {
        return new matchingEngineSdk.MatchingEngineProgram(
          this.program.provider.connection,
          matchingEngineSdk.testnet(),
          this.mint
        );
      }
      case localnet(): {
        return new matchingEngineSdk.MatchingEngineProgram(
          this.program.provider.connection,
          matchingEngineSdk.localnet(),
          this.mint
        );
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }

  coreBridgeProgramId(): PublicKey {
    switch (this._programId) {
      case testnet(): {
        return new PublicKey('3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5');
      }
      case localnet(): {
        return new PublicKey('3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5');
      }
      default: {
        throw new Error('unsupported network');
      }
    }
  }
}

export function localnet(): ProgramId {
  return 'TokenRouter11111111111111111111111111111111';
}

export function testnet(): ProgramId {
  return 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md';
}
