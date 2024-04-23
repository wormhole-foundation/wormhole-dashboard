export * from './state';

import * as wormholeSdk from '@certusone/wormhole-sdk';
import { BN, Program } from '@coral-xyz/anchor';
import * as splToken from '@solana/spl-token';
import {
  ConfirmOptions,
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_EPOCH_SCHEDULE_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Signer,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { PreparedTransaction, PreparedTransactionOptions } from '..';
import { IDL, MatchingEngine } from '../../../../watcher/src/types/matching_engine';
import { MessageTransmitterProgram, TokenMessengerMinterProgram } from '../cctp';
import {
  LiquidityLayerMessage,
  Uint64,
  VaaHash,
  cctpMessageAddress,
  coreMessageAddress,
  reclaimCctpMessageIx,
  uint64ToBN,
  uint64ToBigInt,
  writeUint64BE,
} from '../common';
import { UpgradeManagerProgram } from '../upgradeManager';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, programDataAddress } from '../utils';
import { VaaAccount } from '../wormhole';
import {
  Auction,
  AuctionConfig,
  AuctionHistory,
  AuctionHistoryHeader,
  AuctionInfo,
  AuctionParameters,
  Custodian,
  MessageProtocol,
  PreparedOrderResponse,
  Proposal,
  ProposalAction,
  RedeemedFastFill,
  RouterEndpoint,
} from './state';

export const PROGRAM_IDS = [
  'MatchingEngine11111111111111111111111111111',
  'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS',
] as const;

export const FEE_PRECISION_MAX = 1_000_000n;

export type ProgramId = typeof PROGRAM_IDS[number];

export type AddCctpRouterEndpointArgs = {
  chain: wormholeSdk.ChainId;
  cctpDomain: number;
  address: Array<number>;
  mintRecipient: Array<number> | null;
};

export type WormholeCoreBridgeAccounts = {
  coreBridgeConfig: PublicKey;
  coreEmitterSequence: PublicKey;
  coreFeeCollector: PublicKey;
  coreBridgeProgram: PublicKey;
};

export type PublishMessageAccounts = WormholeCoreBridgeAccounts & {
  custodian: PublicKey;
  coreMessage: PublicKey;
};

export type MatchingEngineCommonAccounts = WormholeCoreBridgeAccounts & {
  matchingEngineProgram: PublicKey;
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
};

export type BurnAndPublishAccounts = {
  custodian: PublicKey;
  routerEndpoint: PublicKey;
  coreMessage: PublicKey;
  cctpMessage: PublicKey;
  coreBridgeConfig: PublicKey;
  coreEmitterSequence: PublicKey;
  coreFeeCollector: PublicKey;
  coreBridgeProgram: PublicKey;
  tokenMessengerMinterSenderAuthority: PublicKey;
  messageTransmitterConfig: PublicKey;
  tokenMessenger: PublicKey;
  remoteTokenMessenger: PublicKey;
  tokenMinter: PublicKey;
  localToken: PublicKey;
  tokenMessengerMinterEventAuthority: PublicKey;
  messageTransmitterProgram: PublicKey;
  tokenMessengerMinterProgram: PublicKey;
};

export type RedeemFastFillAccounts = {
  custodian: PublicKey;
  redeemedFastFill: PublicKey;
  fromRouterEndpoint: PublicKey;
  toRouterEndpoint: PublicKey;
  localCustodyToken: PublicKey;
  matchingEngineProgram: PublicKey;
};

export type CctpMessageArgs = {
  encodedCctpMessage: Buffer;
  cctpAttestation: Buffer;
};

export type AuctionSettled = {
  auction: PublicKey;
  bestOfferToken: PublicKey | null;
  tokenBalanceAfter: BN;
};

export type AuctionUpdated = {
  configId: number;
  auction: PublicKey;
  vaa: PublicKey | null;
  sourceChain: number;
  targetProtocol: MessageProtocol;
  endSlot: BN;
  bestOfferToken: PublicKey;
  tokenBalanceBefore: BN;
  amountIn: BN;
  totalDeposit: BN;
  maxOfferPriceAllowed: BN;
};

export type OrderExecuted = {
  auction: PublicKey;
  vaa: PublicKey;
  targetProtocol: MessageProtocol;
};

export type Proposed = {
  action: ProposalAction;
};

export type Enacted = {
  action: ProposalAction;
};

export class MatchingEngineProgram {
  private _programId: ProgramId;
  private _mint: PublicKey;

  program: Program<MatchingEngine>;

  constructor(connection: Connection, programId: ProgramId, mint: PublicKey) {
    this._programId = programId;
    this._mint = mint;
    this.program = new Program(IDL as any, new PublicKey(this._programId), {
      connection,
    });
  }

  get ID(): PublicKey {
    return this.program.programId;
  }

  get mint(): PublicKey {
    return this._mint;
  }

  onAuctionSettled(callback: (event: AuctionSettled, slot: number, signature: string) => void) {
    return this.program.addEventListener('AuctionSettled', callback);
  }

  onAuctionUpdated(callback: (event: AuctionUpdated, slot: number, signature: string) => void) {
    return this.program.addEventListener('AuctionUpdated', callback);
  }

  onOrderExecuted(callback: (event: OrderExecuted, slot: number, signature: string) => void) {
    return this.program.addEventListener('OrderExecuted', callback);
  }

  onProposed(callback: (event: Proposed, slot: number, signature: string) => void) {
    return this.program.addEventListener('Proposed', callback);
  }

  onEnacted(callback: (event: Enacted, slot: number, signature: string) => void) {
    return this.program.addEventListener('Enacted', callback);
  }

  custodianAddress(): PublicKey {
    return Custodian.address(this.ID);
  }

  async fetchCustodian(input?: { address: PublicKey }): Promise<Custodian> {
    const addr = input === undefined ? this.custodianAddress() : input.address;
    return this.program.account.custodian.fetch(addr);
  }

  auctionConfigAddress(id: number): PublicKey {
    return AuctionConfig.address(this.ID, id);
  }

  async fetchAuctionConfig(input: number | { address: PublicKey }): Promise<AuctionConfig> {
    const addr = typeof input === 'number' ? this.auctionConfigAddress(input) : input.address;
    return this.program.account.auctionConfig.fetch(addr);
  }

  async fetchAuctionParameters(id?: number): Promise<AuctionParameters> {
    if (id === undefined) {
      const { auctionConfigId } = await this.fetchCustodian();
      id = auctionConfigId;
    }
    return this.fetchAuctionConfig(id).then((config) => config.parameters);
  }

  cctpMintRecipientAddress(): PublicKey {
    return splToken.getAssociatedTokenAddressSync(this.mint, this.custodianAddress(), true);
  }

  routerEndpointAddress(chain: wormholeSdk.ChainId): PublicKey {
    return RouterEndpoint.address(this.ID, chain);
  }

  async fetchRouterEndpoint(
    input: wormholeSdk.ChainId | { address: PublicKey }
  ): Promise<RouterEndpoint> {
    const addr =
      typeof input == 'object' && 'address' in input
        ? input.address
        : this.routerEndpointAddress(input);
    return this.program.account.routerEndpoint.fetch(addr);
  }

  auctionAddress(vaaHash: VaaHash): PublicKey {
    return Auction.address(this.ID, vaaHash);
  }

  async fetchAuction(input: VaaHash | { address: PublicKey }): Promise<Auction> {
    const addr = 'address' in input ? input.address : this.auctionAddress(input);
    // @ts-ignore This is BS. This is correct.
    return this.program.account.auction.fetch(addr);
  }

  async proposalAddress(proposalId?: Uint64): Promise<PublicKey> {
    if (proposalId === undefined) {
      const { nextProposalId } = await this.fetchCustodian();
      proposalId = nextProposalId;
    }

    return Proposal.address(this.ID, proposalId);
  }

  async fetchProposal(input?: { address: PublicKey }): Promise<Proposal> {
    const addr = input === undefined ? await this.proposalAddress() : input.address;
    // @ts-ignore This is BS. This is correct.
    return this.program.account.proposal.fetch(addr);
  }

  coreMessageAddress(auction: PublicKey): PublicKey {
    return coreMessageAddress(this.ID, auction);
  }

  cctpMessageAddress(auction: PublicKey): PublicKey {
    return cctpMessageAddress(this.ID, auction);
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

  redeemedFastFillAddress(vaaHash: VaaHash): PublicKey {
    return RedeemedFastFill.address(this.ID, vaaHash);
  }

  fetchRedeemedFastFill(input: VaaHash | { address: PublicKey }): Promise<RedeemedFastFill> {
    const addr = 'address' in input ? input.address : this.redeemedFastFillAddress(input);
    return this.program.account.redeemedFastFill.fetch(addr);
  }

  preparedOrderResponseAddress(fastVaaHash: VaaHash): PublicKey {
    return PreparedOrderResponse.address(this.ID, fastVaaHash);
  }

  async fetchPreparedOrderResponse(
    input: VaaHash | { address: PublicKey }
  ): Promise<PreparedOrderResponse> {
    const addr = 'address' in input ? input.address : this.preparedOrderResponseAddress(input);
    return this.program.account.preparedOrderResponse.fetch(addr);
  }

  preparedCustodyTokenAddress(preparedOrderResponse: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('prepared-custody'), preparedOrderResponse.toBuffer()],
      this.ID
    )[0];
  }

  auctionCustodyTokenAddress(auction: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('auction-custody'), auction.toBuffer()],
      this.ID
    )[0];
  }

  async fetchAuctionCustodyTokenBalance(auction: PublicKey): Promise<bigint> {
    return splToken
      .getAccount(this.program.provider.connection, this.auctionCustodyTokenAddress(auction))
      .then((token) => token.amount)
      .catch((_) => 0n);
  }

  localCustodyTokenAddress(sourceChain: number): PublicKey {
    const encodedSourceChain = Buffer.alloc(2);
    encodedSourceChain.writeUInt16BE(sourceChain);

    return PublicKey.findProgramAddressSync(
      [Buffer.from('local-custody'), encodedSourceChain],
      this.ID
    )[0];
  }

  async fetchLocalCustodyTokenBalance(sourceChain: number): Promise<bigint> {
    return splToken
      .getAccount(this.program.provider.connection, this.localCustodyTokenAddress(sourceChain))
      .then((token) => token.amount)
      .catch((_) => 0n);
  }

  transferAuthorityAddress(auction: PublicKey, offerPrice: Uint64): PublicKey {
    const encodedOfferPrice = Buffer.alloc(8);
    writeUint64BE(encodedOfferPrice, offerPrice);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('transfer-authority'), auction.toBuffer(), encodedOfferPrice],
      this.ID
    )[0];
  }

  auctionHistoryAddress(id: Uint64): PublicKey {
    return AuctionHistory.address(this.ID, id);
  }

  async fetchAuctionHistory(input: Uint64 | { address: PublicKey }): Promise<AuctionHistory> {
    const addr =
      typeof input === 'bigint' || typeof input === 'number' || input instanceof BN
        ? this.auctionHistoryAddress(input)
        : input.address;
    return this.program.account.auctionHistory.fetch(addr);
  }

  async fetchAuctionHistoryHeader(
    input: Uint64 | { address: PublicKey }
  ): Promise<[AuctionHistoryHeader, number]> {
    const addr =
      typeof input === 'bigint' || typeof input === 'number' || input instanceof BN
        ? this.auctionHistoryAddress(input)
        : input.address;
    const accInfo = await this.program.provider.connection.getAccountInfo(addr, {
      dataSlice: { offset: 0, length: 30 },
    });
    if (accInfo === null) {
      throw new Error('Auction history not found');
    }

    const { data } = accInfo;

    // Validate discriminator.
    let offset = 0;
    const disc = data.subarray(offset, (offset += 8));
    if (!disc.equals(Uint8Array.from([149, 208, 45, 154, 47, 248, 102, 245]))) {
      throw new Error('Invalid account history discriminator');
    }

    const id = uint64ToBN(data.readBigUInt64LE(offset));
    offset += 8;
    const hasMinTimestamp = data[offset++] === 1;
    const minTimestamp = hasMinTimestamp ? data.readUInt32LE(offset) : null;
    offset += 4;
    const hasMaxTimestamp = data[offset++] === 1;
    const maxTimestamp = hasMaxTimestamp ? data.readUInt32LE(offset) : null;
    offset += 4;
    const numEntries = data.readUInt32LE(offset);
    return [{ id, minTimestamp, maxTimestamp }, numEntries];
  }

  async approveTransferAuthorityIx(
    accounts: {
      auction: PublicKey;
      owner: PublicKey;
    },
    amounts: {
      offerPrice: Uint64;
      totalDeposit: Uint64;
    }
  ): Promise<{ transferAuthority: PublicKey; ix: TransactionInstruction }> {
    const { auction, owner } = accounts;
    const { offerPrice, totalDeposit } = amounts;

    const transferAuthority = this.transferAuthorityAddress(auction, offerPrice);

    return {
      transferAuthority,
      ix: splToken.createApproveInstruction(
        splToken.getAssociatedTokenAddressSync(this.mint, owner),
        transferAuthority,
        owner,
        uint64ToBigInt(totalDeposit)
      ),
    };
  }

  async commonAccounts(): Promise<MatchingEngineCommonAccounts> {
    const custodian = this.custodianAddress();
    const { coreBridgeConfig, coreEmitterSequence, coreFeeCollector, coreBridgeProgram } =
      await this.publishMessageAccounts(PublicKey.default);

    const tokenMessengerMinterProgram = this.tokenMessengerMinterProgram();
    const messageTransmitterProgram = this.messageTransmitterProgram();

    const cctpMintRecipient = this.cctpMintRecipientAddress();
    const mint = this.mint;

    return {
      matchingEngineProgram: this.ID,
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

  routerEndpointComposite(addr: PublicKey): { endpoint: PublicKey } {
    return {
      endpoint: addr,
    };
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

  localTokenRouterComposite(tokenRouterProgram: PublicKey): {
    tokenRouterProgram: PublicKey;
    tokenRouterEmitter: PublicKey;
    tokenRouterMintRecipient: PublicKey;
  } {
    const [tokenRouterEmitter] = PublicKey.findProgramAddressSync(
      [Buffer.from('emitter')],
      tokenRouterProgram
    );
    return {
      tokenRouterProgram,
      tokenRouterEmitter,
      tokenRouterMintRecipient: splToken.getAssociatedTokenAddressSync(
        this.mint,
        tokenRouterEmitter,
        true
      ),
    };
  }

  async activeAuctionComposite(
    accounts: {
      auction: PublicKey;
      config?: PublicKey;
      bestOfferToken?: PublicKey;
    },
    cached: {
      auctionInfo?: AuctionInfo;
    } = {}
  ) {
    const { auction } = accounts;

    let { config, bestOfferToken } = accounts;
    let { auctionInfo } = cached;

    if (config === undefined || bestOfferToken === undefined) {
      if (auctionInfo === undefined) {
        const { info } = await this.fetchAuction({ address: auction });
        if (info === null) {
          throw new Error('Auction info not found');
        }
        auctionInfo = info;
      }

      config ??= this.auctionConfigAddress(auctionInfo.configId);
      bestOfferToken ??= auctionInfo.bestOfferToken;
    }

    return {
      custodyToken: this.auctionCustodyTokenAddress(auction),
      auction,
      config,
      bestOfferToken,
    };
  }

  closePreparedOrderResponseComposite(accounts: { by: PublicKey; orderResponse: PublicKey }): {
    by: PublicKey;
    orderResponse: PublicKey;
    custodyToken: PublicKey;
  } {
    const { by, orderResponse } = accounts;
    return {
      by,
      orderResponse,
      custodyToken: this.preparedCustodyTokenAddress(orderResponse),
    };
  }

  liveRouterPathComposite(accounts: { fromEndpoint: PublicKey; toEndpoint: PublicKey }): {
    fromEndpoint: { endpoint: PublicKey };
    toEndpoint: { endpoint: PublicKey };
  } {
    const { fromEndpoint, toEndpoint } = accounts;
    return {
      fromEndpoint: { endpoint: fromEndpoint },
      toEndpoint: { endpoint: toEndpoint },
    };
  }

  fastOrderPathComposite(accounts: {
    fastVaa: PublicKey;
    fromEndpoint: PublicKey;
    toEndpoint: PublicKey;
  }): {
    fastVaa: {
      vaa: PublicKey;
    };
    path: {
      fromEndpoint: {
        endpoint: PublicKey;
      };
      toEndpoint: { endpoint: PublicKey };
    };
  } {
    const { fastVaa, fromEndpoint, toEndpoint } = accounts;
    return {
      fastVaa: { vaa: fastVaa },
      path: this.liveRouterPathComposite({ fromEndpoint, toEndpoint }),
    };
  }

  cctpMintRecipientComposite(): { mintRecipient: PublicKey } {
    return {
      mintRecipient: this.cctpMintRecipientAddress(),
    };
  }

  async initializeIx(
    accounts: {
      owner: PublicKey;
      ownerAssistant: PublicKey;
      feeRecipient: PublicKey;
      mint?: PublicKey;
    },
    auctionParams: AuctionParameters
  ): Promise<TransactionInstruction> {
    const { owner, ownerAssistant, feeRecipient, mint } = accounts;

    const upgradeManager = this.upgradeManagerProgram();
    return this.program.methods
      .initialize(auctionParams)
      .accounts({
        owner,
        custodian: this.custodianAddress(),
        auctionConfig: this.auctionConfigAddress(0),
        ownerAssistant,
        feeRecipient,
        feeRecipientToken: splToken.getAssociatedTokenAddressSync(this.mint, feeRecipient),
        cctpMintRecipient: this.cctpMintRecipientAddress(),
        usdc: this.usdcComposite(mint),
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
    const { ownerOrAssistant, custodian } = accounts;
    return this.program.methods
      .setPause(paused)
      .accounts({
        admin: this.adminMutComposite(ownerOrAssistant, custodian),
      })
      .instruction();
  }

  async submitOwnershipTransferIx(accounts: {
    owner: PublicKey;
    newOwner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, newOwner, custodian } = accounts;
    return this.program.methods
      .submitOwnershipTransferRequest()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, custodian),
        newOwner,
      })
      .instruction();
  }

  async confirmOwnershipTransferIx(accounts: {
    pendingOwner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { pendingOwner } = accounts;
    let { custodian } = accounts;
    custodian ??= this.custodianAddress();
    return this.program.methods
      .confirmOwnershipTransferRequest()
      .accounts({ pendingOwner, custodian })
      .instruction();
  }

  async cancelOwnershipTransferIx(accounts: {
    owner: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, custodian } = accounts;
    return this.program.methods
      .cancelOwnershipTransferRequest()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, custodian),
      })
      .instruction();
  }

  async updateOwnerAssistantIx(accounts: {
    owner: PublicKey;
    newOwnerAssistant: PublicKey;
    custodian?: PublicKey;
  }) {
    const { owner, newOwnerAssistant, custodian } = accounts;
    return this.program.methods
      .updateOwnerAssistant()
      .accounts({
        admin: this.ownerOnlyMutComposite(owner, custodian),
        newOwnerAssistant,
      })
      .instruction();
  }

  async addCctpRouterEndpointIx(
    accounts: {
      ownerOrAssistant: PublicKey;
      payer?: PublicKey;
      custodian?: PublicKey;
      routerEndpoint?: PublicKey;
      remoteTokenMessenger?: PublicKey;
    },
    args: AddCctpRouterEndpointArgs
  ): Promise<TransactionInstruction> {
    const { ownerOrAssistant, custodian } = accounts;
    const { chain, cctpDomain } = args;

    let { payer, routerEndpoint, remoteTokenMessenger } = accounts;
    payer ??= ownerOrAssistant;
    routerEndpoint ??= this.routerEndpointAddress(chain);
    remoteTokenMessenger ??=
      this.tokenMessengerMinterProgram().remoteTokenMessengerAddress(cctpDomain);

    return this.program.methods
      .addCctpRouterEndpoint(args)
      .accounts({
        payer,
        admin: this.adminComposite(ownerOrAssistant, custodian),
        routerEndpoint,
        localCustodyToken: this.localCustodyTokenAddress(chain),
        remoteTokenMessenger,
        usdc: this.usdcComposite(),
      })
      .instruction();
  }

  async updateCctpRouterEndpointIx(
    accounts: {
      owner: PublicKey;
      custodian?: PublicKey;
      routerEndpoint?: PublicKey;
      remoteTokenMessenger?: PublicKey;
    },
    args: AddCctpRouterEndpointArgs
  ): Promise<TransactionInstruction> {
    const { owner, custodian } = accounts;
    const { chain, cctpDomain } = args;

    let { routerEndpoint, remoteTokenMessenger } = accounts;
    routerEndpoint ??= this.routerEndpointAddress(chain);
    remoteTokenMessenger ??=
      this.tokenMessengerMinterProgram().remoteTokenMessengerAddress(cctpDomain);

    return this.program.methods
      .updateCctpRouterEndpoint(args)
      .accounts({
        admin: this.ownerOnlyComposite(owner, custodian),
        routerEndpoint: this.routerEndpointComposite(routerEndpoint),
        remoteTokenMessenger,
      })
      .instruction();
  }

  async proposeAuctionParametersIx(
    accounts: {
      ownerOrAssistant: PublicKey;
      payer?: PublicKey;
      custodian?: PublicKey;
      proposal?: PublicKey;
    },
    parameters: AuctionParameters,
    opts: {
      proposalId?: Uint64;
    } = {}
  ): Promise<TransactionInstruction> {
    const { ownerOrAssistant, custodian } = accounts;

    let { payer, proposal } = accounts;
    payer ??= ownerOrAssistant;
    proposal ??= await this.proposalAddress(opts.proposalId);

    return this.program.methods
      .proposeAuctionParameters(parameters)
      .accounts({
        payer,
        admin: {
          ownerOrAssistant,
          custodian: this.checkedCustodianComposite(custodian),
        },
        proposal,
        epochSchedule: SYSVAR_EPOCH_SCHEDULE_PUBKEY,
      })
      .instruction();
  }

  async closeProposalIx(
    accounts: {
      ownerOrAssistant: PublicKey;
      proposal?: PublicKey;
    },
    opts: {
      proposalId?: Uint64;
    } = {}
  ): Promise<TransactionInstruction> {
    const { ownerOrAssistant } = accounts;

    let { proposal } = accounts;
    proposal ??= await this.proposalAddress(opts.proposalId);

    const { by: proposedBy } = await this.fetchProposal({ address: proposal });

    return this.program.methods
      .closeProposal()
      .accounts({
        admin: this.adminComposite(ownerOrAssistant),
        proposedBy,
        proposal,
      })
      .instruction();
  }

  async updateAuctionParametersIx(
    accounts: {
      owner: PublicKey;
      payer?: PublicKey;
      custodian?: PublicKey;
      proposal?: PublicKey;
      auctionConfig?: PublicKey;
    },
    opts: {
      proposalId?: Uint64;
    } = {}
  ): Promise<TransactionInstruction> {
    const { owner, custodian } = accounts;

    let { payer, proposal, auctionConfig } = accounts;
    payer ??= owner;
    proposal ??= await this.proposalAddress(opts.proposalId);

    if (auctionConfig === undefined) {
      const { auctionConfigId } = await this.fetchCustodian();
      // Add 1 to the current auction config ID to get the next one.
      auctionConfig = this.auctionConfigAddress(auctionConfigId + 1);
    }

    return this.program.methods
      .updateAuctionParameters()
      .accounts({
        payer,
        admin: this.ownerOnlyMutComposite(owner, custodian),
        proposal,
        auctionConfig,
      })
      .instruction();
  }

  async addLocalRouterEndpointIx(accounts: {
    ownerOrAssistant: PublicKey;
    tokenRouterProgram: PublicKey;
    payer?: PublicKey;
    custodian?: PublicKey;
    routerEndpoint?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { ownerOrAssistant, tokenRouterProgram, custodian } = accounts;

    let { payer, routerEndpoint } = accounts;
    payer ??= ownerOrAssistant;
    routerEndpoint ??= this.routerEndpointAddress(wormholeSdk.CHAIN_ID_SOLANA);

    return this.program.methods
      .addLocalRouterEndpoint()
      .accounts({
        payer,
        admin: this.adminComposite(ownerOrAssistant, custodian),
        routerEndpoint,
        local: this.localTokenRouterComposite(tokenRouterProgram),
      })
      .instruction();
  }

  async updateLocalRouterEndpointIx(accounts: {
    owner: PublicKey;
    tokenRouterProgram: PublicKey;
    custodian?: PublicKey;
    routerEndpoint?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { owner, tokenRouterProgram, custodian } = accounts;

    let { routerEndpoint } = accounts;
    routerEndpoint ??= this.routerEndpointAddress(wormholeSdk.CHAIN_ID_SOLANA);

    return this.program.methods
      .updateLocalRouterEndpoint()
      .accounts({
        admin: this.ownerOnlyComposite(owner, custodian),
        routerEndpoint: this.routerEndpointComposite(routerEndpoint),
        local: this.localTokenRouterComposite(tokenRouterProgram),
      })
      .instruction();
  }

  async disableRouterEndpointIx(
    accounts: {
      owner: PublicKey;
      custodian?: PublicKey;
      routerEndpoint?: PublicKey;
    },
    chain: wormholeSdk.ChainId
  ): Promise<TransactionInstruction> {
    const { owner, custodian } = accounts;

    let { routerEndpoint } = accounts;
    routerEndpoint ??= this.routerEndpointAddress(chain);

    return this.program.methods
      .disableRouterEndpoint()
      .accounts({
        admin: this.ownerOnlyComposite(owner, custodian),
        routerEndpoint: this.routerEndpointComposite(routerEndpoint),
      })
      .instruction();
  }

  async updateFeeRecipientIx(accounts: {
    ownerOrAssistant: PublicKey;
    newFeeRecipient: PublicKey;
    custodian?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { ownerOrAssistant, newFeeRecipient, custodian } = accounts;

    return this.program.methods
      .updateFeeRecipient()
      .accounts({
        admin: this.adminMutComposite(ownerOrAssistant, custodian),
        newFeeRecipient,
        newFeeRecipientToken: splToken.getAssociatedTokenAddressSync(this.mint, newFeeRecipient),
      })
      .instruction();
  }

  async fetchCctpMintRecipient(): Promise<splToken.Account> {
    return splToken.getAccount(this.program.provider.connection, this.cctpMintRecipientAddress());
  }

  async placeInitialOfferTx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      fromRouterEndpoint: PublicKey;
      toRouterEndpoint: PublicKey;
      auction: PublicKey;
    },
    args: {
      offerPrice: Uint64;
      totalDeposit: Uint64;
    },
    signers: Signer[],
    opts: PreparedTransactionOptions,
    confirmOptions?: ConfirmOptions
  ): Promise<PreparedTransaction> {
    const { payer, fastVaa, auction, fromRouterEndpoint, toRouterEndpoint } = accounts;
    const ixs = await this.placeInitialOfferCctpIx(
      {
        payer,
        fastVaa,
        auction,
        fromRouterEndpoint,
        toRouterEndpoint,
      },
      args
    );

    return {
      ixs,
      signers,
      computeUnits: opts.computeUnits!,
      feeMicroLamports: opts.feeMicroLamports,
      nonceAccount: opts.nonceAccount,
      addressLookupTableAccounts: opts.addressLookupTableAccounts,
      txName: 'placeInitialOffer',
      confirmOptions,
    };
  }

  async placeInitialOfferCctpIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      offerToken?: PublicKey;
      auction?: PublicKey;
      auctionConfig?: PublicKey;
      fromRouterEndpoint?: PublicKey;
      toRouterEndpoint?: PublicKey;
    },
    args: {
      offerPrice: Uint64;
      totalDeposit?: Uint64;
    }
  ): Promise<[approveIx: TransactionInstruction, placeInitialOfferCctpIx: TransactionInstruction]> {
    const { payer, fastVaa } = accounts;

    const { offerPrice } = args;

    let { auction, auctionConfig, offerToken, fromRouterEndpoint, toRouterEndpoint } = accounts;
    let { totalDeposit } = args;

    offerToken ??= await splToken.getAssociatedTokenAddress(this.mint, payer);
    let fetchedConfigId: Uint64 | null = null;
    if (
      auction === undefined ||
      fromRouterEndpoint === undefined ||
      toRouterEndpoint === undefined ||
      totalDeposit === undefined
    ) {
      const vaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction ??= this.auctionAddress(vaaAccount.digest());
      fromRouterEndpoint ??= this.routerEndpointAddress(vaaAccount.emitterInfo().chain);
      const { fastMarketOrder } = LiquidityLayerMessage.decode(vaaAccount.payload());
      if (fastMarketOrder === undefined) {
        throw new Error('Message not FastMarketOrder');
      }
      toRouterEndpoint ??= this.routerEndpointAddress(fastMarketOrder.targetChain);

      const custodianData = await this.fetchCustodian();
      fetchedConfigId = custodianData.auctionConfigId;

      const notionalDeposit = await this.computeNotionalSecurityDeposit(
        fastMarketOrder.amountIn,
        fetchedConfigId
      );

      totalDeposit ??= fastMarketOrder.amountIn + fastMarketOrder.maxFee + notionalDeposit;
    }

    if (auctionConfig === undefined) {
      if (fetchedConfigId === null) {
        const custodianData = await this.fetchCustodian();
        fetchedConfigId = custodianData.auctionConfigId;
      }
      auctionConfig = this.auctionConfigAddress(fetchedConfigId);
    }

    const auctionCustodyToken = this.auctionCustodyTokenAddress(auction);
    const { transferAuthority, ix: approveIx } = await this.approveTransferAuthorityIx(
      { auction, owner: payer },
      {
        totalDeposit,
        offerPrice,
      }
    );
    const placeInitialOfferCctpIx = await this.program.methods
      .placeInitialOfferCctp(uint64ToBN(offerPrice))
      .accounts({
        payer,
        transferAuthority,
        custodian: this.checkedCustodianComposite(),
        auctionConfig,
        auction,
        fastOrderPath: this.fastOrderPathComposite({
          fastVaa,
          fromEndpoint: fromRouterEndpoint,
          toEndpoint: toRouterEndpoint,
        }),
        offerToken,
        auctionCustodyToken,
        usdc: this.usdcComposite(),
      })
      .instruction();

    return [approveIx, placeInitialOfferCctpIx];
  }

  async improveOfferTx(
    accounts: {
      participant: PublicKey;
      auction: PublicKey;
      auctionConfig: PublicKey;
      bestOfferToken: PublicKey;
    },
    args: {
      offerPrice: Uint64;
      totalDeposit: Uint64;
    },
    signers: Signer[],
    opts: PreparedTransactionOptions,
    confirmOptions?: ConfirmOptions
  ): Promise<PreparedTransaction> {
    const { participant, auction, auctionConfig, bestOfferToken } = accounts;

    const ixs = await this.improveOfferIx(
      {
        participant,
        auction,
        auctionConfig,
        bestOfferToken,
      },
      args
    );

    return {
      ixs,
      signers,
      computeUnits: opts.computeUnits,
      feeMicroLamports: opts.feeMicroLamports,
      nonceAccount: opts.nonceAccount,
      addressLookupTableAccounts: opts.addressLookupTableAccounts,
      txName: 'improveOffer',
      confirmOptions,
    };
  }

  async improveOfferIx(
    accounts: {
      participant: PublicKey;
      auction: PublicKey;
      auctionConfig?: PublicKey;
      bestOfferToken?: PublicKey;
    },
    args: { offerPrice: Uint64; totalDeposit?: Uint64 }
  ): Promise<[approveIx: TransactionInstruction, improveOfferIx: TransactionInstruction]> {
    const { participant, auction, auctionConfig, bestOfferToken } = accounts;
    const { offerPrice } = args;

    let { totalDeposit } = args;

    let auctionInfo: AuctionInfo | undefined;
    if (totalDeposit === undefined) {
      const { info } = await this.fetchAuction({ address: auction });
      if (info === null) {
        throw new Error('no auction info found');
      }
      auctionInfo = info;
      totalDeposit = BigInt(auctionInfo.amountIn.add(auctionInfo.securityDeposit).toString());
    }

    const { transferAuthority, ix: approveIx } = await this.approveTransferAuthorityIx(
      { auction, owner: participant },
      {
        offerPrice,
        totalDeposit,
      }
    );

    const improveOfferIx = await this.program.methods
      .improveOffer(uint64ToBN(offerPrice))
      .accounts({
        transferAuthority,
        activeAuction: await this.activeAuctionComposite(
          { auction, config: auctionConfig, bestOfferToken: bestOfferToken },
          { auctionInfo }
        ),
        offerToken: splToken.getAssociatedTokenAddressSync(this.mint, participant),
      })
      .instruction();

    return [approveIx, improveOfferIx];
  }

  async prepareOrderResponseCctpIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      finalizedVaa: PublicKey;
    },
    args: CctpMessageArgs
  ): Promise<TransactionInstruction> {
    const { payer, fastVaa, finalizedVaa } = accounts;

    const fastVaaAcct = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
    const { encodedCctpMessage } = args;
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
      messageTransmitterProgram,
      tokenMessengerMinterEventAuthority,
    } = this.messageTransmitterProgram().receiveTokenMessengerMinterMessageAccounts(
      this.mint,
      encodedCctpMessage
    );

    const preparedOrderResponse = this.preparedOrderResponseAddress(fastVaaAcct.digest());
    return this.program.methods
      .prepareOrderResponseCctp(args)
      .accounts({
        payer,
        custodian: this.checkedCustodianComposite(),
        fastVaa: this.liquidityLayerVaaComposite(fastVaa),
        finalizedVaa: this.liquidityLayerVaaComposite(finalizedVaa),
        preparedOrderResponse,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedOrderResponse),
        usdc: this.usdcComposite(),
        cctp: {
          mintRecipient: this.cctpMintRecipientComposite(),
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

  async settleAuctionCompleteTx(
    accounts: {
      executor: PublicKey;
      fastVaa: PublicKey;
      finalizedVaa: PublicKey;
      bestOfferToken: PublicKey;
      auction: PublicKey;
    },
    args: CctpMessageArgs,
    signers: Signer[],
    opts: PreparedTransactionOptions,
    confirmOptions?: ConfirmOptions
  ): Promise<PreparedTransaction> {
    let { executor, fastVaa, finalizedVaa, auction, bestOfferToken } = accounts;

    const prepareOrderResponseIx = await this.prepareOrderResponseCctpIx(
      { payer: executor, fastVaa, finalizedVaa },
      args
    );
    const fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);

    // Fetch the prepared order response.
    const preparedOrderResponse = this.preparedOrderResponseAddress(fastVaaAccount.digest());

    // The executor must be the owner of the best offer token if there is no penalty.
    const { status } = await this.fetchAuction({ address: auction });
    if (status.completed?.executePenalty === null) {
      const { owner } = await splToken.getAccount(this.program.provider.connection, bestOfferToken);
      executor = owner;
    }

    const settleAuctionCompletedIx = await this.settleAuctionCompleteIx({
      executor,
      auction,
      preparedOrderResponse,
      bestOfferToken,
    });

    const preparedTx: PreparedTransaction = {
      ixs: [prepareOrderResponseIx, settleAuctionCompletedIx],
      signers,
      computeUnits: opts.computeUnits!,
      feeMicroLamports: opts.feeMicroLamports,
      nonceAccount: opts.nonceAccount,
      addressLookupTableAccounts: opts.addressLookupTableAccounts,
      txName: 'settleAuctionComplete',
      confirmOptions,
    };

    return preparedTx;
  }

  async settleAuctionCompleteIx(accounts: {
    executor: PublicKey;
    preparedOrderResponse: PublicKey;
    auction?: PublicKey;
    bestOfferToken?: PublicKey;
  }) {
    const { executor, preparedOrderResponse } = accounts;

    let { auction, bestOfferToken } = accounts;

    if (auction === undefined) {
      const { fastVaaHash } = await this.fetchPreparedOrderResponse({
        address: preparedOrderResponse,
      });

      auction = this.auctionAddress(fastVaaHash);
    }

    if (bestOfferToken === undefined) {
      const { info } = await this.fetchAuction({ address: auction });
      if (info === null) {
        throw new Error('no auction info found');
      }

      bestOfferToken = info.bestOfferToken;
    }

    return this.program.methods
      .settleAuctionComplete()
      .accounts({
        executor,
        executorToken: splToken.getAssociatedTokenAddressSync(this.mint, executor),
        preparedOrderResponse,
        preparedCustodyToken: this.preparedCustodyTokenAddress(preparedOrderResponse),
        auction,
        bestOfferToken,
      })
      .instruction();
  }

  async settleAuctionNoneTx(
    accounts: {
      executor: PublicKey;
      fastVaa: PublicKey;
      finalizedVaa: PublicKey;
      auction?: PublicKey;
    },
    args: CctpMessageArgs,
    signers: Signer[],
    opts: PreparedTransactionOptions,
    confirmOptions?: ConfirmOptions
  ): Promise<PreparedTransaction> {
    const { executor, fastVaa, finalizedVaa, auction } = accounts;
    const prepareOrderResponseIx = await this.prepareOrderResponseCctpIx(
      { payer: executor, fastVaa, finalizedVaa },
      args
    );
    const fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
    const { fastMarketOrder } = LiquidityLayerMessage.decode(fastVaaAccount.payload());
    if (fastMarketOrder === undefined) {
      throw new Error('Message not FastMarketOrder');
    }

    // Fetch the prepared order response.
    const preparedOrderResponse = this.preparedOrderResponseAddress(fastVaaAccount.digest());

    const settleAuctionNoneIx = await (async () => {
      if (fastMarketOrder.targetChain === wormholeSdk.CHAIN_ID_SOLANA) {
        return this.settleAuctionNoneLocalIx({
          payer: executor,
          fastVaa,
          preparedOrderResponse,
          auction,
        });
      } else {
        return this.settleAuctionNoneCctpIx(
          {
            payer: executor,
            fastVaa,
            preparedOrderResponse,
          },
          { targetChain: fastMarketOrder.targetChain }
        );
      }
    })();

    const preparedTx: PreparedTransaction = {
      ixs: [prepareOrderResponseIx, settleAuctionNoneIx],
      signers,
      computeUnits: opts.computeUnits!,
      feeMicroLamports: opts.feeMicroLamports,
      nonceAccount: opts.nonceAccount,
      addressLookupTableAccounts: opts.addressLookupTableAccounts,
      txName: 'settleAuctionComplete',
      confirmOptions,
    };

    return preparedTx;
  }

  async settleAuctionNoneLocalIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      preparedOrderResponse?: PublicKey;
      auction?: PublicKey;
    },
    opts: {
      sourceChain?: wormholeSdk.ChainId;
    } = {}
  ) {
    const { payer, fastVaa } = accounts;

    let { auction, preparedOrderResponse } = accounts;
    let { sourceChain } = opts;

    let fastVaaAccount: VaaAccount | undefined;
    if (auction === undefined || preparedOrderResponse === undefined) {
      fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction ??= this.auctionAddress(fastVaaAccount.digest());
      preparedOrderResponse ??= this.preparedOrderResponseAddress(fastVaaAccount.digest());
    }

    if (sourceChain === undefined) {
      fastVaaAccount ??= await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      sourceChain ??= fastVaaAccount.emitterInfo().chain;
    }

    const {
      custodian,
      coreMessage,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
    } = await this.publishMessageAccounts(auction);

    const { feeRecipientToken } = await this.fetchCustodian();

    return this.program.methods
      .settleAuctionNoneLocal()
      .accounts({
        payer,
        coreMessage,
        custodian: this.checkedCustodianComposite(custodian),
        feeRecipientToken,
        prepared: this.closePreparedOrderResponseComposite({
          by: payer,
          orderResponse: preparedOrderResponse,
        }),
        fastOrderPath: this.fastOrderPathComposite({
          fastVaa,
          fromEndpoint: this.routerEndpointAddress(sourceChain),
          toEndpoint: this.routerEndpointAddress(wormholeSdk.CHAIN_ID_SOLANA),
        }),
        auction,
        wormhole: {
          config: coreBridgeConfig,
          emitterSequence: coreEmitterSequence,
          feeCollector: coreFeeCollector,
          coreBridgeProgram,
        },
      })
      .instruction();
  }

  async settleAuctionNoneCctpIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      preparedOrderResponse?: PublicKey;
      auction?: PublicKey;
    },
    opts: {
      sourceChain?: wormholeSdk.ChainId;
      targetChain?: wormholeSdk.ChainId;
    } = {}
  ) {
    const { payer, fastVaa } = accounts;

    let { auction, preparedOrderResponse } = accounts;
    let { sourceChain, targetChain } = opts;

    let fastVaaAccount: VaaAccount | undefined;
    if (auction === undefined || preparedOrderResponse === undefined) {
      fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction ??= this.auctionAddress(fastVaaAccount.digest());
      preparedOrderResponse ??= this.preparedOrderResponseAddress(fastVaaAccount.digest());
    }

    if (sourceChain === undefined || targetChain === undefined) {
      fastVaaAccount ??= await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      sourceChain ??= fastVaaAccount.emitterInfo().chain;

      const message = LiquidityLayerMessage.decode(fastVaaAccount.payload());
      if (message.fastMarketOrder == undefined) {
        throw new Error('Message not FastMarketOrder');
      }

      targetChain ??= message.fastMarketOrder.targetChain;
    }
    const {
      custodian,
      routerEndpoint: toRouterEndpoint,
      coreMessage,
      cctpMessage,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
      tokenMessengerMinterSenderAuthority,
      messageTransmitterConfig,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenMessengerMinterEventAuthority,
      messageTransmitterProgram,
      tokenMessengerMinterProgram,
    } = await this.burnAndPublishAccounts(auction, { targetChain });

    const { feeRecipientToken } = await this.fetchCustodian();

    return this.program.methods
      .settleAuctionNoneCctp()
      .accounts({
        payer,
        coreMessage,
        cctpMessage,
        custodian: this.checkedCustodianComposite(custodian),
        feeRecipientToken,
        prepared: this.closePreparedOrderResponseComposite({
          by: payer,
          orderResponse: preparedOrderResponse,
        }),
        fastOrderPath: this.fastOrderPathComposite({
          fastVaa,
          fromEndpoint: this.routerEndpointAddress(sourceChain),
          toEndpoint: toRouterEndpoint,
        }),
        auction,
        wormhole: {
          config: coreBridgeConfig,
          emitterSequence: coreEmitterSequence,
          feeCollector: coreFeeCollector,
          coreBridgeProgram,
        },
        cctp: {
          mint: this.mint,
          tokenMessengerMinterSenderAuthority,
          messageTransmitterConfig,
          tokenMessenger,
          remoteTokenMessenger,
          tokenMinter,
          localToken,
          tokenMessengerMinterEventAuthority,
          tokenMessengerMinterProgram,
          messageTransmitterProgram,
        },
      })
      .instruction();
  }

  async executeFastOrderTx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      auction?: PublicKey;
      executorToken?: PublicKey;
    },
    signers: Signer[],
    opts: PreparedTransactionOptions,
    confirmOptions?: ConfirmOptions
  ): Promise<PreparedTransaction> {
    const { payer, fastVaa, executorToken } = accounts;

    let { auction } = accounts;

    let fastVaaAccount: VaaAccount | undefined;
    let targetChain: wormholeSdk.ChainId | undefined;
    if (auction === undefined) {
      fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction = this.auctionAddress(fastVaaAccount.digest());
      const { fastMarketOrder } = LiquidityLayerMessage.decode(fastVaaAccount.payload());
      if (fastMarketOrder === undefined) {
        throw new Error('Message not FastMarketOrder');
      }

      targetChain = fastMarketOrder.targetChain;
    }

    // TODO: Make this smarter. Consider adding a target chain argument.
    if (targetChain === undefined) {
      fastVaaAccount ??= await VaaAccount.fetch(this.program.provider.connection, fastVaa);

      const { fastMarketOrder } = LiquidityLayerMessage.decode(fastVaaAccount.payload());
      if (fastMarketOrder === undefined) {
        throw new Error('Message not FastMarketOrder');
      }

      targetChain = fastMarketOrder.targetChain;
    }

    const executeOrderIx = await (async () => {
      if (targetChain === wormholeSdk.CHAIN_ID_SOLANA) {
        return this.executeFastOrderLocalIx({
          payer,
          fastVaa,
          auction,
          executorToken,
        });
      } else {
        return this.executeFastOrderCctpIx(
          {
            payer,
            fastVaa,
            auction,
            executorToken,
          },
          { targetChain }
        );
      }
    })();

    return {
      ixs: [executeOrderIx],
      signers,
      computeUnits: opts.computeUnits!,
      feeMicroLamports: opts.feeMicroLamports,
      nonceAccount: opts.nonceAccount,
      addressLookupTableAccounts: opts.addressLookupTableAccounts,
      txName: 'executeOrder',
      confirmOptions,
    };
  }

  async executeFastOrderCctpIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      executorToken?: PublicKey;
      auction?: PublicKey;
      auctionConfig?: PublicKey;
      bestOfferToken?: PublicKey;
      initialOfferToken?: PublicKey;
    },
    opts: {
      targetChain?: wormholeSdk.ChainId;
    } = {}
  ) {
    const { payer, fastVaa, auctionConfig, bestOfferToken } = accounts;

    let { auction, executorToken, initialOfferToken } = accounts;
    let { targetChain } = opts;

    executorToken ??= splToken.getAssociatedTokenAddressSync(this.mint, payer);

    let fastVaaAccount: VaaAccount | undefined;
    if (auction === undefined) {
      fastVaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction = this.auctionAddress(fastVaaAccount.digest());
    }

    if (targetChain === undefined) {
      fastVaaAccount ??= await VaaAccount.fetch(this.program.provider.connection, fastVaa);

      const { fastMarketOrder } = LiquidityLayerMessage.decode(fastVaaAccount.payload());
      if (fastMarketOrder === undefined) {
        throw new Error('Message not FastMarketOrder');
      }
      targetChain ??= fastMarketOrder.targetChain;
    }

    let auctionInfo: AuctionInfo | undefined;
    if (initialOfferToken === undefined) {
      const { info } = await this.fetchAuction({ address: auction });
      if (info === null) {
        throw new Error('no auction info found');
      }
      auctionInfo = info;
      initialOfferToken = info.initialOfferToken;
    }

    const {
      custodian,
      routerEndpoint: toRouterEndpoint,
      coreMessage,
      cctpMessage,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
      tokenMessengerMinterSenderAuthority,
      messageTransmitterConfig,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenMessengerMinterEventAuthority,
      messageTransmitterProgram,
      tokenMessengerMinterProgram,
    } = await this.burnAndPublishAccounts(auction, { targetChain });

    const mint = this.mint;
    return this.program.methods
      .executeFastOrderCctp()
      .accounts({
        payer,
        coreMessage,
        cctpMessage,
        executeOrder: {
          fastVaa: this.liquidityLayerVaaComposite(fastVaa),
          activeAuction: await this.activeAuctionComposite(
            {
              auction,
              config: auctionConfig,
              bestOfferToken,
            },
            { auctionInfo }
          ),
          executorToken,
          initialOfferToken,
        },
        toRouterEndpoint: this.routerEndpointComposite(toRouterEndpoint),
        custodian: this.checkedCustodianComposite(custodian),
        wormhole: {
          config: coreBridgeConfig,
          emitterSequence: coreEmitterSequence,
          feeCollector: coreFeeCollector,
          coreBridgeProgram,
        },
        cctp: {
          mint,
          tokenMessengerMinterSenderAuthority,
          messageTransmitterConfig,
          tokenMessenger,
          remoteTokenMessenger,
          tokenMinter,
          localToken,
          tokenMessengerMinterEventAuthority,
          tokenMessengerMinterProgram,
          messageTransmitterProgram,
        },
      })
      .instruction();
  }

  async executeFastOrderLocalIx(
    accounts: {
      payer: PublicKey;
      fastVaa: PublicKey;
      executorToken?: PublicKey;
      auction?: PublicKey;
      auctionConfig?: PublicKey;
      bestOfferToken?: PublicKey;
      initialOfferToken?: PublicKey;
      toRouterEndpoint?: PublicKey;
    },
    opts: {
      sourceChain?: wormholeSdk.ChainId;
    } = {}
  ) {
    const { payer, fastVaa, auctionConfig, bestOfferToken } = accounts;

    let { auction, executorToken, toRouterEndpoint, initialOfferToken } = accounts;
    let { sourceChain } = opts;
    executorToken ??= splToken.getAssociatedTokenAddressSync(this.mint, payer);
    toRouterEndpoint ??= this.routerEndpointAddress(wormholeSdk.CHAIN_ID_SOLANA);

    if (auction === undefined) {
      const vaaAccount = await VaaAccount.fetch(this.program.provider.connection, fastVaa);
      auction = this.auctionAddress(vaaAccount.digest());
    }

    let auctionInfo: AuctionInfo | undefined;
    if (initialOfferToken === undefined || sourceChain === undefined) {
      const { info } = await this.fetchAuction({ address: auction });
      if (info === null) {
        throw new Error('no auction info found');
      }
      auctionInfo = info;

      // Shouldn't be a problem.
      if (!wormholeSdk.isChain(auctionInfo.sourceChain)) {
        throw new Error('invalid source chain');
      }
      sourceChain ??= auctionInfo.sourceChain;
      initialOfferToken ??= auctionInfo.initialOfferToken;
    }

    const {
      custodian,
      coreMessage,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
    } = await this.publishMessageAccounts(auction);

    return this.program.methods
      .executeFastOrderLocal()
      .accounts({
        payer,
        custodian: this.checkedCustodianComposite(custodian),
        coreMessage,
        executeOrder: {
          fastVaa: this.liquidityLayerVaaComposite(fastVaa),
          activeAuction: await this.activeAuctionComposite(
            {
              auction,
              config: auctionConfig,
              bestOfferToken,
            },
            { auctionInfo }
          ),
          executorToken,
          initialOfferToken,
        },
        toRouterEndpoint: this.routerEndpointComposite(toRouterEndpoint),
        wormhole: {
          config: coreBridgeConfig,
          emitterSequence: coreEmitterSequence,
          feeCollector: coreFeeCollector,
          coreBridgeProgram,
        },
        localCustodyToken: this.localCustodyTokenAddress(sourceChain),
      })
      .instruction();
  }

  async redeemFastFillAccounts(
    vaa: PublicKey,
    sourceChain?: wormholeSdk.ChainId
  ): Promise<{ vaaAccount: VaaAccount; accounts: RedeemFastFillAccounts }> {
    const vaaAccount = await VaaAccount.fetch(this.program.provider.connection, vaa);

    if (sourceChain === undefined) {
      const { fastFill } = LiquidityLayerMessage.decode(vaaAccount.payload());
      if (fastFill === undefined) {
        throw new Error('Message not FastFill');
      }

      sourceChain = fastFill.fill.sourceChain;
    }

    const localCustodyToken = this.localCustodyTokenAddress(sourceChain);

    return {
      vaaAccount,
      accounts: {
        custodian: this.custodianAddress(),
        redeemedFastFill: this.redeemedFastFillAddress(vaaAccount.digest()),
        fromRouterEndpoint: this.routerEndpointAddress(sourceChain),
        toRouterEndpoint: this.routerEndpointAddress(wormholeSdk.CHAIN_ID_SOLANA),
        localCustodyToken,
        matchingEngineProgram: this.ID,
      },
    };
  }

  async publishMessageAccounts(auction: PublicKey): Promise<PublishMessageAccounts> {
    const coreMessage = this.coreMessageAddress(auction);

    const coreBridgeProgram = this.coreBridgeProgramId();
    const custodian = this.custodianAddress();

    return {
      custodian,
      coreMessage,
      coreBridgeConfig: PublicKey.findProgramAddressSync(
        [Buffer.from('Bridge')],
        coreBridgeProgram
      )[0],
      coreEmitterSequence: PublicKey.findProgramAddressSync(
        [Buffer.from('Sequence'), custodian.toBuffer()],
        coreBridgeProgram
      )[0],
      coreFeeCollector: PublicKey.findProgramAddressSync(
        [Buffer.from('fee_collector')],
        coreBridgeProgram
      )[0],
      coreBridgeProgram,
    };
  }

  async burnAndPublishAccounts(
    auction: PublicKey,
    args: {
      targetChain: wormholeSdk.ChainId;
      destinationCctpDomain?: number;
    }
  ): Promise<BurnAndPublishAccounts> {
    const { targetChain } = args;

    let { destinationCctpDomain } = args;

    if (destinationCctpDomain === undefined) {
      const { protocol } = await this.fetchRouterEndpoint(targetChain);
      if (protocol.cctp === undefined) {
        throw new Error('not CCTP endpoint');
      }
      destinationCctpDomain = protocol.cctp.domain;
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
      destinationCctpDomain
    );

    const {
      custodian,
      coreMessage,
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
    } = await this.publishMessageAccounts(auction);

    return {
      custodian,
      routerEndpoint: this.routerEndpointAddress(targetChain),
      coreMessage,
      cctpMessage: this.cctpMessageAddress(auction),
      coreBridgeConfig,
      coreEmitterSequence,
      coreFeeCollector,
      coreBridgeProgram,
      tokenMessengerMinterSenderAuthority,
      messageTransmitterConfig,
      tokenMessenger,
      remoteTokenMessenger,
      tokenMinter,
      localToken,
      tokenMessengerMinterEventAuthority,
      messageTransmitterProgram,
      tokenMessengerMinterProgram,
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

  async computeDepositPenalty(
    auctionInfo: AuctionInfo,
    currentSlot: Uint64,
    configId?: number
  ): Promise<{ penalty: bigint; userReward: bigint }> {
    const auctionParams = await this.fetchAuctionParameters(configId);

    const gracePeriod = BigInt(auctionParams.gracePeriod);
    const slotsElapsed =
      uint64ToBigInt(currentSlot) -
      uint64ToBigInt(auctionInfo.startSlot) -
      BigInt(auctionParams.duration);
    if (slotsElapsed <= gracePeriod) {
      return { penalty: 0n, userReward: 0n };
    }

    const amount = uint64ToBigInt(auctionInfo.securityDeposit);

    const penaltyPeriod = slotsElapsed - gracePeriod;
    const auctionPenaltySlots = BigInt(auctionParams.penaltyPeriod);
    const initialPenaltyBps = BigInt(auctionParams.initialPenaltyBps);
    const userPenaltyRewardBps = BigInt(auctionParams.userPenaltyRewardBps);

    if (penaltyPeriod >= auctionPenaltySlots || initialPenaltyBps == FEE_PRECISION_MAX) {
      const userReward = (amount * userPenaltyRewardBps) / FEE_PRECISION_MAX;
      return { penalty: amount - userReward, userReward };
    } else {
      const basePenalty = (amount * initialPenaltyBps) / FEE_PRECISION_MAX;
      const penalty = basePenalty + ((amount - basePenalty) * penaltyPeriod) / auctionPenaltySlots;
      const userReward = (penalty * userPenaltyRewardBps) / FEE_PRECISION_MAX;

      return { penalty: penalty - userReward, userReward };
    }
  }

  async computeMinOfferDelta(offerPrice: Uint64): Promise<bigint> {
    const { minOfferDeltaBps } = await this.fetchAuctionParameters();
    return (uint64ToBigInt(offerPrice) * BigInt(minOfferDeltaBps)) / FEE_PRECISION_MAX;
  }

  async computeNotionalSecurityDeposit(amountIn: Uint64, configId?: number) {
    const { securityDepositBase, securityDepositBps } = await this.fetchAuctionParameters(configId);
    return (
      uint64ToBigInt(securityDepositBase) +
      (uint64ToBigInt(amountIn) * BigInt(securityDepositBps)) / FEE_PRECISION_MAX
    );
  }
}

export function testnet(): ProgramId {
  return 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS';
}

export function localnet(): ProgramId {
  return 'MatchingEngine11111111111111111111111111111';
}
