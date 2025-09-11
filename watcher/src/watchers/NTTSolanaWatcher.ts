import { AnchorProvider, BorshCoder, Wallet } from '@coral-xyz/anchor';
import { Program } from 'anchor-0.29.0';
import {
  Commitment,
  ConfirmedSignatureInfo,
  Connection,
  Keypair,
  MessageCompiledInstruction,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { Network, chainToChainId, toChainId } from '@wormhole-foundation/sdk-base';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import knex, { Knex } from 'knex';
import {
  LifeCycle,
  NTT_DECIMALS,
  NTT_QUOTER_CONTRACT,
  ReceiveWormholeMessageIx,
  RedeemIx,
  ReleaseInboundMintIx,
  ReleaseInboundUnlockIx,
  ReleaseWormholeOutboundIx,
  RequestRelayIx,
  TransferBurnIx,
  TransferLockIx,
  getNttManagerMessageDigest,
} from '../NTTConsts';
import { NTT_MANAGER_CONTRACT_ARRAY } from '@wormhole-foundation/wormhole-monitor-common';
import { RPCS_BY_CHAIN } from '../consts';
import { makeBlockKey } from '../databases/utils';
import NTT_IDL from '../idls/example_native_token_transfers.json';
import { NttQuoter } from '../quoters/NTTSolanaQuoter';
import { type ExampleNativeTokenTransfers as RawExampleNativeTokenTransfers } from '../types/example_native_token_transfers';
import { WormholeLogger } from '../utils/logger';
import { findFromSignatureAndToSignature } from '../utils/solana';
import { millisecondsToTimestamp } from '../utils/timestamp';
import {
  NativeTokenTransfer,
  NttManagerMessage,
  TrimmedAmount,
  ValidatedTransceiverMessage,
  WormholeTransceiverMessage,
} from './NTTPayloads';
import { deserializePostMessage } from '@wormhole-foundation/sdk-solana-core';
import { SVMWatcher } from './SVMWatcher';

const COMMITMENT: Commitment = 'finalized';
const GET_SIGNATURES_LIMIT = 1000;

// This is a workaround for the fact that the anchor idl doesn't support generics
// yet. This type is used to remove the generics from the idl types.
type OmitGenerics<T> = {
  [P in keyof T]: T[P] extends Record<'generics', any>
    ? never
    : T[P] extends object
    ? OmitGenerics<T[P]>
    : T[P];
};

type SolanaMessageData = {
  sequence: bigint;
  emitterChain: number;
  emitterAddress: Buffer;
};

export type ExampleNativeTokenTransfers = OmitGenerics<RawExampleNativeTokenTransfers>;

export class NTTSolanaWatcher extends SVMWatcher {
  readonly rpc: string;
  readonly programIds: string[];
  readonly quoterProgramId: string;
  readonly program: Program<ExampleNativeTokenTransfers>;
  readonly NttQuoter: NttQuoter;
  readonly provider: AnchorProvider;
  readonly nttBorsh: BorshCoder;
  // program: Program;
  // this is set as a class field so we can modify it in tests
  getSignaturesLimit = GET_SIGNATURES_LIMIT;
  // The Solana watcher uses the `getSignaturesForAddress` RPC endpoint to fetch all transactions
  // containing Wormhole messages. This API takes in signatures and paginates based on number of
  // transactions returned. Since we don't know the number of transactions in advance, we use
  // a block range of 100K slots. Technically, batch size can be arbitrarily large since pagination
  // of the WH transactions within that range is handled internally below.
  maximumBatchSize = 100_000;
  pg: Knex;

  constructor(network: Network) {
    super(network, 'Solana', 'ntt');
    this.rpc = RPCS_BY_CHAIN[this.network].Solana!;
    this.programIds = NTT_MANAGER_CONTRACT_ARRAY[this.network].Solana!;
    this.connection = new Connection(this.rpc, COMMITMENT);

    // Initialize the NttQuoter
    // Required to check if a relay was requested
    this.quoterProgramId = NTT_QUOTER_CONTRACT[this.network].Solana!;
    this.NttQuoter = new NttQuoter(this.connection, this.quoterProgramId);

    // We are using the Anchor framework to interact with the NTT program
    // This provides a fairly easy way to deserialize the accounts specified in the IDL file
    // TODO: we should probably find a reliable way to get the IDL file. Currently, it's just
    // copied from the NTT repo.
    const walletKeyPair = Keypair.generate();
    const wallet = new Wallet(walletKeyPair);
    this.provider = new AnchorProvider(
      this.getConnection(),
      wallet,
      AnchorProvider.defaultOptions()
    );
    this.program = new Program(
      NTT_IDL as any,
      new PublicKey(this.coreBridgeProgramId),
      this.provider
    );
    this.nttBorsh = new BorshCoder(NTT_IDL as any);

    this.pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_NTT_USER'),
        password: assertEnvironmentVariable('PG_NTT_PASSWORD'),
        database: assertEnvironmentVariable('PG_NTT_DATABASE'),
        host: assertEnvironmentVariable('PG_NTT_HOST'),
        port: Number(assertEnvironmentVariable('PG_NTT_PORT')),
      },
    });
  }

  // This function is used to deserialize the transceiver message account.
  // Solana follows the borsh encoding format.
  // More details can be found in the deserialize implementation.
  private async transceiverMessageAccountToTransceiverMessage(
    transceiverMessageAccountKey: PublicKey
  ): Promise<ValidatedTransceiverMessage<NativeTokenTransfer>> {
    const transceiverMessage = await this.getConnection().getAccountInfo(
      transceiverMessageAccountKey
    );
    if (!transceiverMessage) {
      throw new Error('transceiverMessage is null');
    }

    const transceiverMessageData = ValidatedTransceiverMessage.deserialize(
      transceiverMessage.data,
      (a) => {
        return NttManagerMessage.deserializeAccountFormat(
          a,
          NativeTokenTransfer.deserializeAccountFormat
        );
      }
    );

    if (!transceiverMessageData) {
      throw new Error('transceiverMessageData is null');
    }

    return transceiverMessageData;
  }

  // This function is used to fetch the post message from the wormhole program.
  // The accountKey argument is the wormhole message or vaa account key.
  private async fetchAndDeserializePostMessage(
    accountKey: PublicKey,
    deserializer: (data: Buffer) => NttManagerMessage<NativeTokenTransfer>
  ): Promise<{
    postMessage: SolanaMessageData;
    transceiverMessage: WormholeTransceiverMessage<NativeTokenTransfer>;
  }> {
    let msgData: SolanaMessageData;
    const acctInfo = await this.getConnection().getAccountInfo(accountKey, COMMITMENT);
    if (!acctInfo?.data) throw new Error('No data found in message account');
    const { emitterAddress, sequence, emitterChain, payload } = deserializePostMessage(
      new Uint8Array(acctInfo.data)
    );
    msgData = {
      sequence,
      emitterChain,
      emitterAddress: Buffer.from(emitterAddress.toUint8Array()),
    };
    const transceiverMessage = WormholeTransceiverMessage.deserialize(
      Buffer.from(payload),
      deserializer
    );
    return { postMessage: msgData, transceiverMessage };
  }

  // parseTransferIx parses the instruction for both TransferLock and TransferBurn
  // It extracts info from outboxItem to create a nttManagerMessage.
  // The nttManagerMessage is used to create the lifecycle digest.
  private async parseTransferIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    if (!transaction.blockTime) {
      throw new Error('blockTime is null');
    }

    const configAccount = accountKeys[instructionAccountKeyIndexes[1]];
    const outboxAccount = accountKeys[instructionAccountKeyIndexes[5]];

    const config = await this.program.account.config.fetch(configAccount);
    const outboxItemAccount = await this.program.account.outboxItem.fetch(outboxAccount);

    const outboxQueuedTime = String(transaction.blockTime * 1000);
    const outboxReleaseTime = (outboxItemAccount.releaseTimestamp.toNumber() * 1000).toString();

    const nttManagerMessage: NttManagerMessage<NativeTokenTransfer> = {
      id: outboxAccount.toBuffer(),
      sender: outboxItemAccount.sender.toBuffer(),
      payload: {
        sourceToken: config.mint.toBuffer(),
        trimmedAmount: new TrimmedAmount(
          BigInt(outboxItemAccount.amount.amount.toString()),
          outboxItemAccount.amount.decimals
        ),
        recipientChain: outboxItemAccount.recipientChain.id,
        recipientAddress: Buffer.from(outboxItemAccount.recipientAddress),
      },
    };

    const digest = getNttManagerMessageDigest(chainToChainId(this.chain), nttManagerMessage);

    // We save the digest to the outboxItem so we can link the lifecycle to the outboxItem later in the relayRequest ix
    // This is because the relayRequest ix does not contain the necessary information to create the digest, only outboxItem
    await this.saveOutboxItemToDigest(outboxAccount.toBase58(), digest, this.pg);

    const lc: LifeCycle = {
      srcChainId: chainToChainId(this.chain),
      destChainId: toChainId(nttManagerMessage.payload.recipientChain),
      sourceToken: config.mint.toBuffer().toString('hex'),
      tokenAmount: nttManagerMessage.payload.trimmedAmount.normalize(NTT_DECIMALS),
      transferSentTxhash: '',
      transferBlockHeight: 0n,
      nttTransferKey: `${
        this.coreBridgeProgramId
      }/${nttManagerMessage.payload.recipientAddress.toString(
        'hex'
      )}/${nttManagerMessage.id.toString('hex')}`,
      vaaId: '',
      digest: digest,
      isRelay: false,
      transferTime: '',
      redeemTime: '',
      redeemedTxhash: '',
      redeemedBlockHeight: 0n,
      inboundTransferQueuedTime: '',
      outboundTransferQueuedTime: outboxQueuedTime,
      outboundTransferReleasableTime: outboxReleaseTime,
    };

    await this.saveToPG(this.pg, lc, TransferLockIx, this.logger);
    return lc;
  }

  private async parseTransferLockIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    return this.parseTransferIx(transaction, accountKeys, instructionAccountKeyIndexes);
  }

  private parseTransferBurnIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    return this.parseTransferIx(transaction, accountKeys, instructionAccountKeyIndexes);
  }

  // parseRedeemIx parses the instruction for the Redeem instruction.
  // It extracts info from the transceiverMessage to create a nttManagerMessage which is used in creating the digest.
  // Redeem instruction also checks the inbound rate limit and sets the inboundTransferQueuedTime. This is where we get the inboundTransferQueuedTime.
  private async parseRedeemIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    if (!transaction.blockTime) {
      throw new Error('blockTime is null');
    }

    const transceiverMessageAccountKey = accountKeys[instructionAccountKeyIndexes[3]];
    const transceiverMessage = await this.transceiverMessageAccountToTransceiverMessage(
      transceiverMessageAccountKey
    );
    const digest = getNttManagerMessageDigest(
      transceiverMessage.chainId,
      transceiverMessage.ntt_managerPayload
    );

    let lc: LifeCycle = {
      srcChainId: transceiverMessage.chainId,
      destChainId: chainToChainId(this.chain),
      sourceToken: transceiverMessage.ntt_managerPayload.payload.sourceToken.toString('hex'),
      tokenAmount:
        transceiverMessage.ntt_managerPayload.payload.trimmedAmount.normalize(NTT_DECIMALS),
      transferSentTxhash: '',
      transferBlockHeight: 0n,
      nttTransferKey: '',
      vaaId: '',
      digest: digest,
      isRelay: false,
      transferTime: '',
      // TODO: should redeem time be the release time or the actual redeem time?
      // inbound transfer rate limited time is the release time of the inbox item
      redeemTime: '',
      redeemedTxhash: '',
      redeemedBlockHeight: 0n,
      inboundTransferQueuedTime: (transaction.blockTime * 1000).toString(),
      outboundTransferQueuedTime: '',
      outboundTransferReleasableTime: '',
    };

    // The new id is the inboxItem as we need to link this lifecycle to releaseInboundMint/Unlock
    // This is because releaseInboundMint/Unlock does not contain the necessary information to create the digest
    const id = transaction.transaction.message
      .getAccountKeys()
      .staticAccountKeys[instructionAccountKeyIndexes[6]].toBase58();

    await this.saveToPG(this.pg, lc, RedeemIx, this.logger);
    await this.saveInboxItemToDigest(id, lc.digest, this.pg);

    return lc;
  }

  // parseReleaseInboundIx parses the instruction for both ReleaseInboundMint and ReleaseInboundUnlock.
  // It extracts the redeem time and the redeem txhash from the transaction.
  // It has to use the id from the inboxItem to link the lifecycle to the redeem instruction.
  private async parseReleaseInboundIx(
    transaction: VersionedTransactionResponse,
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    if (!transaction.blockTime) {
      throw new Error('blockTime is null');
    }

    const redeemTime = String(transaction.blockTime * 1000);
    const redeemTxhash = transaction.transaction.signatures[0];
    const redeemedBlockHeight = BigInt(transaction.slot);

    let lc: LifeCycle = {
      srcChainId: 0,
      destChainId: chainToChainId(this.chain),
      sourceToken: '',
      tokenAmount: 0n,
      transferSentTxhash: '',
      transferBlockHeight: 0n,
      nttTransferKey: '',
      vaaId: '',
      digest: '',
      isRelay: false,
      transferTime: '',
      redeemTime,
      redeemedTxhash: redeemTxhash,
      redeemedBlockHeight,
      inboundTransferQueuedTime: '',
      outboundTransferQueuedTime: '',
      outboundTransferReleasableTime: '',
    };

    const id = transaction.transaction.message
      .getAccountKeys()
      .staticAccountKeys[instructionAccountKeyIndexes[2]].toBase58();

    await this.saveToPG(this.pg, lc, ReleaseInboundMintIx, this.logger, id);
    await this.deleteInboxItemToDigestByKey(id, this.pg);

    return lc;
  }

  private async parsedReleaseInboundMintIx(
    transaction: VersionedTransactionResponse,
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    return this.parseReleaseInboundIx(transaction, instructionAccountKeyIndexes);
  }

  private parsedReleaseInboundUnlockIx(
    transaction: VersionedTransactionResponse,
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    return this.parseReleaseInboundIx(transaction, instructionAccountKeyIndexes);
  }

  // parsedReceiveWormholeMessageIx parses the instruction for ReceiveWormholeMessage.
  // It extracts postMessage and transceiverMessage from the vaaAccount.
  // This instruction gives us the necessary information to create nttTransferKey and vaaId,
  // which is needed to link with the outbound from the source chain.
  private async parsedReceiveWormholeMessageIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    if (!transaction.blockTime) {
      throw new Error('blockTime is null');
    }

    const vaaAccount = accountKeys[instructionAccountKeyIndexes[3]];

    const { postMessage, transceiverMessage } = await this.fetchAndDeserializePostMessage(
      vaaAccount,
      (a) => NttManagerMessage.deserialize(a, NativeTokenTransfer.deserialize)
    );
    const recipient =
      transceiverMessage.ntt_managerPayload.payload.recipientAddress.toString('hex');
    const parsedVaa = postMessage;
    const digest = getNttManagerMessageDigest(
      toChainId(parsedVaa.emitterChain),
      transceiverMessage.ntt_managerPayload
    );

    let lc: LifeCycle = {
      srcChainId: toChainId(parsedVaa.emitterChain),
      destChainId: toChainId(transceiverMessage.ntt_managerPayload.payload.recipientChain),
      sourceToken: transceiverMessage.ntt_managerPayload.payload.sourceToken.toString('hex'),
      tokenAmount:
        transceiverMessage.ntt_managerPayload.payload.trimmedAmount.normalize(NTT_DECIMALS),
      transferSentTxhash: '',
      transferBlockHeight: 0n,
      nttTransferKey: `${
        this.coreBridgeProgramId
      }/${recipient}/${transceiverMessage.ntt_managerPayload.id.toString('hex')}`,
      vaaId: `${parsedVaa.emitterChain}/${parsedVaa.emitterAddress.toString('hex')}/${
        parsedVaa.sequence
      }`,
      digest: digest,
      isRelay: false,
      transferTime: '',
      redeemTime: '',
      redeemedTxhash: '',
      redeemedBlockHeight: 0n,
      inboundTransferQueuedTime: '',
      outboundTransferQueuedTime: '',
      outboundTransferReleasableTime: '',
    };

    await this.saveToPG(this.pg, lc, ReceiveWormholeMessageIx, this.logger);
    return lc;
  }

  // parsedReleaseWormholeOutboundIx parses the instruction for ReleaseWormholeOutbound.
  // Significant data here is the vaaId as we cannot find it in any of the outbound lifecycle on Solana.
  private async parsedReleaseWormholeOutboundIx(
    transaction: VersionedTransactionResponse,
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ): Promise<LifeCycle> {
    if (!transaction.blockTime) {
      throw new Error('blockTime is null');
    }

    const wormholeMessageAccount = accountKeys[instructionAccountKeyIndexes[4]];
    const emitter = accountKeys[instructionAccountKeyIndexes[5]];

    const { postMessage, transceiverMessage } = await this.fetchAndDeserializePostMessage(
      wormholeMessageAccount,
      (a) => NttManagerMessage.deserialize(a, NativeTokenTransfer.deserialize)
    );

    const recipient =
      transceiverMessage.ntt_managerPayload.payload.recipientAddress.toString('hex');
    const seq = postMessage.sequence;
    const emitterHex = Array.from(emitter.toBytes())
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const vaaId = `${postMessage.emitterChain}/${emitterHex}/${seq}`;

    let lc: LifeCycle = {
      srcChainId: chainToChainId(this.chain),
      destChainId: toChainId(transceiverMessage.ntt_managerPayload.payload.recipientChain),
      sourceToken: transceiverMessage.ntt_managerPayload.payload.sourceToken.toString('hex'),
      tokenAmount:
        transceiverMessage.ntt_managerPayload.payload.trimmedAmount.normalize(NTT_DECIMALS),
      transferSentTxhash: transaction.transaction.signatures[0],
      transferBlockHeight: BigInt(transaction.slot),
      nttTransferKey: `${this.coreBridgeProgramId}/${recipient}/${seq}`,
      vaaId: vaaId,
      digest: getNttManagerMessageDigest(
        chainToChainId(this.chain),
        transceiverMessage.ntt_managerPayload
      ),
      isRelay: false,
      transferTime: String(transaction.blockTime * 1000),
      redeemTime: '',
      redeemedTxhash: '',
      redeemedBlockHeight: 0n,
      inboundTransferQueuedTime: '',
      outboundTransferQueuedTime: '',
      outboundTransferReleasableTime: '',
    };

    await this.saveToPG(this.pg, lc, ReleaseWormholeOutboundIx, this.logger);

    return lc;
  }

  private async parseRequestRelayIx(
    accountKeys: PublicKey[],
    instructionAccountKeyIndexes: number[]
  ) {
    // TODO: update this index when xLabs deploy quoter 0.1.0. The correct index is 4.
    const outboxItem = accountKeys[instructionAccountKeyIndexes[3]];
    const wasRelayRequested = (await this.NttQuoter.wasRelayRequested(outboxItem)) !== null;
    const digest = await this.getDigestFromOutboxItem(outboxItem.toBase58(), this.pg);

    // We know for sure that the relay was requested, so we can delete the outboxItem
    await this.deleteOutboxItemToDigestByKey('outbox_item', outboxItem.toBase58(), this.pg);

    // All we really want to know is that a relay was requested
    let lc: LifeCycle = {
      srcChainId: 0,
      destChainId: 0,
      sourceToken: '',
      tokenAmount: 0n,
      transferSentTxhash: '',
      transferBlockHeight: 0n,
      nttTransferKey: '',
      vaaId: '',
      digest: digest,
      isRelay: wasRelayRequested,
      transferTime: '',
      redeemTime: '',
      redeemedTxhash: '',
      redeemedBlockHeight: 0n,
      inboundTransferQueuedTime: '',
      outboundTransferQueuedTime: '',
      outboundTransferReleasableTime: '',
    };

    await this.saveToPG(this.pg, lc, RequestRelayIx, this.logger);
    return lc;
  }

  // These are each of the instructions that we care about. We can get ntt_managerMessage from Transfer
  // through Redeem but not from ReleaseInboundMint/ReleaseInboundUnlock. However, we can link Redeem and
  // ReleaseInboundMint/ReleaseInboundUnlock through the inboxItem (account is seeded by ntt_manager_payload)
  // ref: https://github.com/wormhole-foundation/example-native-token-transfers/blob/main/solana/programs/example-native-token-transfers/src/instructions/redeem.rs#L60
  // This is not private so we can use it in tests
  async parseInstruction(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ): Promise<LifeCycle | null> {
    const decodedData = this.nttBorsh.instruction.decode(Buffer.from(instruction.data), 'base58');
    const decodedDataQuoter = this.NttQuoter.borsh.instruction.decode(
      Buffer.from(instruction.data),
      'base58'
    );

    const ixName = decodedData?.name || decodedDataQuoter?.name;
    if (!ixName) {
      this.logger.debug('decodedData is null');
      return null;
    }

    try {
      switch (ixName) {
        case TransferLockIx:
          return this.parseTransferLockIx(
            res,
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        case TransferBurnIx:
          return this.parseTransferBurnIx(
            res,
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        case RedeemIx:
          return this.parseRedeemIx(
            res,
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        case ReleaseInboundMintIx:
          return this.parsedReleaseInboundMintIx(res, instruction.accountKeyIndexes);
        case ReleaseInboundUnlockIx:
          return this.parsedReleaseInboundUnlockIx(res, instruction.accountKeyIndexes);
        case ReceiveWormholeMessageIx:
          return this.parsedReceiveWormholeMessageIx(
            res,
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        case ReleaseWormholeOutboundIx:
          return this.parsedReleaseWormholeOutboundIx(
            res,
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        case RequestRelayIx:
          return this.parseRequestRelayIx(
            res.transaction.message.getAccountKeys().staticAccountKeys,
            instruction.accountKeyIndexes
          );
        default:
          return null;
      }
    } catch (error) {
      // we do not want to throw an error here as we want to continue processing the rest of the instructions
      // TODO: we should probably have a dlq for these errors
      this.logger.error(`error at ${ixName} for ${res.transaction.signatures[0]}:`, error);
    }

    return null;
  }

  async fetchAndProcessMessages(
    fromSignature: string | undefined,
    toSignature: string,
    programId: PublicKey
  ): Promise<ConfirmedSignatureInfo[]> {
    let signatures: ConfirmedSignatureInfo[] = await this.getConnection().getSignaturesForAddress(
      new PublicKey(programId),
      {
        before: fromSignature,
        until: toSignature,
        limit: this.getSignaturesLimit,
      }
    );

    this.logger.info(`processing ${signatures.length} transactions`);

    if (signatures.length === 0) {
      return [];
    }

    // We want to sort them by chronological order and process them from the oldest to the newest
    const results = await this.getConnection().getTransactions(
      signatures.map((s) => s.signature),
      {
        maxSupportedTransactionVersion: 0,
      }
    );

    if (results.length !== signatures.length) {
      throw new Error(`solana: failed to fetch tx for signatures`);
    }

    for (const res of results) {
      if (res?.meta?.err) {
        // skip errored txs
        continue;
      }
      if (!res || !res.blockTime) {
        throw new Error(
          `solana: failed to fetch tx for signature ${res?.transaction.signatures[0] || 'unknown'}`
        );
      }

      const message = res.transaction.message;
      const instructions = message.compiledInstructions;

      // filter out instructions that are not for the program we are interested in
      const programIdIndex = res.transaction.message.staticAccountKeys.findIndex((i) =>
        i.equals(programId)
      );

      const programInstructions = instructions.filter((i) => i.programIdIndex === programIdIndex);

      for (const instruction of programInstructions) {
        try {
          await this.parseInstruction(res, instruction);
        } catch (error) {
          this.logger.error('error:', error);
        }
      }
    }

    return signatures;
  }

  async getNttMessagesForBlocks(fromSlot: number, toSlot: number): Promise<string> {
    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);
    const { fromSignature, toSignature, toBlock } = await findFromSignatureAndToSignature(
      this.getConnection(),
      fromSlot,
      toSlot
    );

    // check ntt program
    for (const programId of this.programIds) {
      let numSignatures = this.getSignaturesLimit;
      let currSignature: string | undefined = fromSignature;

      while (numSignatures === this.getSignaturesLimit) {
        const signatures: ConfirmedSignatureInfo[] = await this.fetchAndProcessMessages(
          currSignature,
          toSignature,
          new PublicKey(programId)
        );
        numSignatures = signatures.length;
        currSignature = signatures.at(-1)?.signature;
      }
    }

    // check quoter program
    let numSignatures = this.getSignaturesLimit;
    let currSignature: string | undefined = fromSignature;

    while (numSignatures === this.getSignaturesLimit) {
      const signatures: ConfirmedSignatureInfo[] = await this.fetchAndProcessMessages(
        currSignature,
        toSignature,
        new PublicKey(this.quoterProgramId)
      );
      numSignatures = signatures.length;
      currSignature = signatures.at(-1)?.signature;
    }

    const lastBlockKey = makeBlockKey(
      toSlot.toString(),
      new Date(toBlock.blockTime! * 1000).toISOString()
    );
    return lastBlockKey;
  }

  // Get the digest from the inboxItem
  // Used in releaseInboundMint/Unlock to link the lifecycle to the previous instructions
  async getDigestFromInboxItem(InboxItem: string, pg: Knex): Promise<string> {
    if (!InboxItem) {
      throw new Error('InboxItem is required');
    }

    const result = await pg('inbox_item_to_lifecycle_digest')
      .where('inbox_item', InboxItem)
      .select('digest')
      .first();

    if (!result) {
      throw new Error(`No digest found for InboxItem: ${InboxItem}`);
    }

    return result.digest;
  }

  // Save the inboxItem to the digest
  // Used in redeem to link inboxItem to digest.
  // This is needed as the relevant information to create the digest is not found in the releaseInbound instructions.
  async saveInboxItemToDigest(InboxItem: string, digest: string, pg: Knex): Promise<void> {
    if (!InboxItem) {
      throw new Error('InboxItem is required');
    }

    if (!digest) {
      throw new Error('digest is required');
    }

    await pg('inbox_item_to_lifecycle_digest')
      .insert({
        inbox_item: InboxItem,
        digest: digest,
      })
      .onConflict('inbox_item')
      .merge({
        digest: digest,
      });
  }

  async deleteInboxItemToDigestByKey(InboxItem: string, pg: Knex): Promise<void> {
    if (!InboxItem) {
      throw new Error('InboxItem is required');
    }

    await pg('inbox_item_to_lifecycle_digest').where('inbox_item', InboxItem).delete();
  }

  async getDigestFromOutboxItem(OutboxItem: string, pg: Knex): Promise<string> {
    if (!OutboxItem) {
      throw new Error('OutboxItem is required');
    }

    const result = await pg('outbox_item_to_lifecycle_digest')
      .where('outbox_item', OutboxItem)
      .select('digest')
      .first();

    if (!result) {
      throw new Error(`No digest found for OutboxItem: ${OutboxItem}`);
    }

    return result.digest;
  }

  async saveOutboxItemToDigest(OutboxItem: string, digest: string, pg: Knex): Promise<void> {
    if (!OutboxItem) {
      throw new Error('OutboxItem is required');
    }

    if (!digest) {
      throw new Error('digest is required');
    }

    await pg('outbox_item_to_lifecycle_digest')
      .insert({
        outbox_item: OutboxItem,
        digest: digest,
      })
      .onConflict('outbox_item')
      .merge({
        digest: digest,
      });
  }

  // We should invoke this function when the transfer goes to the EVM side, that is when we know the relay will not be requested anymore
  async deleteOutboxItemToDigestByKey(columnName: string, value: string, pg: Knex): Promise<void> {
    if (!columnName || !value) {
      throw new Error('column_name and value is required');
    }

    await pg('outbox_item_to_lifecycle_digest').where(columnName, value).delete();
  }

  async saveToPG(
    pg: Knex,
    lc: LifeCycle,
    initiatingEvent: string,
    logger: WormholeLogger,
    inboxItem?: string
  ) {
    if (!pg) {
      throw new Error('pg not initialized');
    }

    if (initiatingEvent === ReleaseInboundMintIx || initiatingEvent === ReleaseInboundUnlockIx) {
      if (!inboxItem) {
        throw new Error('inboxItem is required');
      }
      lc.digest = await this.getDigestFromInboxItem(inboxItem, pg);
    }

    logger.debug('saveToPG: Attempting to get existing record...');
    await pg.transaction(async (trx) => {
      const existing = await trx('life_cycle').where('digest', lc.digest).first();
      if (!existing) {
        logger.debug('saveToPG: Inserting new record');
        await trx('life_cycle').insert({
          from_chain: lc.srcChainId,
          to_chain: lc.destChainId,
          from_token: lc.sourceToken,
          token_amount: lc.tokenAmount,
          transfer_sent_txhash: lc.transferSentTxhash,
          transfer_block_height: lc.transferBlockHeight,
          redeemed_txhash: lc.redeemedTxhash,
          redeemed_block_height: lc.redeemedBlockHeight,
          ntt_transfer_key: lc.nttTransferKey,
          vaa_id: lc.vaaId,
          digest: lc.digest,
          is_relay: lc.isRelay,
          transfer_time:
            lc.transferTime.length > 0 ? millisecondsToTimestamp(lc.transferTime) : null,
          redeem_time: lc.redeemTime.length > 0 ? millisecondsToTimestamp(lc.redeemTime) : null,
          inbound_transfer_queued_time:
            lc.inboundTransferQueuedTime.length > 0
              ? millisecondsToTimestamp(lc.inboundTransferQueuedTime)
              : null,
          outbound_transfer_queued_time:
            lc.outboundTransferQueuedTime.length > 0
              ? millisecondsToTimestamp(lc.outboundTransferQueuedTime)
              : null,
          outbound_transfer_releasable_time:
            lc.outboundTransferReleasableTime.length > 0
              ? millisecondsToTimestamp(lc.outboundTransferReleasableTime)
              : null,
        });
        return;
      }
      // If the row already exists, then we need to update it with the information from the initiating event
      logger.debug('saveToPG: Updating existing record');
      if (initiatingEvent === TransferLockIx || initiatingEvent === TransferBurnIx) {
        await trx('life_cycle')
          .where('digest', lc.digest)
          .update({
            from_chain: lc.srcChainId,
            to_chain: lc.destChainId,
            from_token: lc.sourceToken,
            token_amount: lc.tokenAmount,
            ntt_transfer_key: lc.nttTransferKey,
            digest: lc.digest,
            outbound_transfer_queued_time: millisecondsToTimestamp(lc.outboundTransferQueuedTime),
            outbound_transfer_releasable_time: millisecondsToTimestamp(
              lc.outboundTransferReleasableTime
            ),
          });
      } else if (initiatingEvent === ReleaseWormholeOutboundIx) {
        await trx('life_cycle')
          .where('digest', lc.digest)
          .update({
            vaa_id: lc.vaaId,
            transfer_sent_txhash: lc.transferSentTxhash,
            transfer_block_height: lc.transferBlockHeight,
            transfer_time: millisecondsToTimestamp(lc.transferTime),
          });
      } else if (initiatingEvent === RequestRelayIx) {
        await trx('life_cycle').where('digest', lc.digest).update({
          is_relay: lc.isRelay,
        });
      } else if (initiatingEvent === ReceiveWormholeMessageIx) {
        await trx('life_cycle').where('digest', lc.digest).update({
          vaa_id: lc.vaaId,
        });
      } else if (initiatingEvent === RedeemIx) {
        // TODO: should redeem time be the release time or the actual redeem time?
        await trx('life_cycle')
          .where('digest', lc.digest)
          .update({
            inbound_transfer_queued_time: millisecondsToTimestamp(lc.inboundTransferQueuedTime),
          });
      } else if (
        initiatingEvent === ReleaseInboundMintIx ||
        initiatingEvent === ReleaseInboundUnlockIx
      ) {
        await trx('life_cycle')
          .where('digest', lc.digest)
          .update({
            redeem_time: millisecondsToTimestamp(lc.redeemTime),
            redeemed_txhash: lc.redeemedTxhash,
            redeemed_block_height: lc.redeemedBlockHeight,
          });
      } else {
        logger.error(`saveToPG: Unknown initiating event: ${initiatingEvent} and lifeCycle: ${lc}`);
      }
    });
  }
}
