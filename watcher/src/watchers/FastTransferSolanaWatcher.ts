import { Network } from '@wormhole-foundation/sdk-base';
import { SolanaWatcher } from './SolanaWatcher';
import { MatchingEngineProgram } from '../fastTransfer/matchingEngine';
import {
  ConfirmedSignatureInfo,
  Connection,
  MessageCompiledInstruction,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { findFromSignatureAndToSignature } from '../utils/solana';
import { makeBlockKey } from '../databases/utils';
import { BorshCoder, Instruction } from '@coral-xyz/anchor';
import MATCHING_ENGINE_IDL from '../idls/matching_engine.json';
import TOKEN_ROUTER_IDL from '../idls/token_router.json';
import { RPCS_BY_CHAIN } from '../consts';
import { VaaAccount } from '../fastTransfer/wormhole';
import { LiquidityLayerMessage } from '../fastTransfer/common';
import { AuctionOffer, FastTransfer, ParsedLogs } from '../fastTransfer/types';
import knex, { Knex } from 'knex';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { getLogger } from '../utils/logger';

// TODO: this is devnet consts
const MATCHING_ENGINE_PROGRAM_ID = 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS';
const TOKEN_ROUTER_PROGRAM_ID = 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md';
const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export class FastTransferSolanaWatcher extends SolanaWatcher {
  readonly rpc: string;
  readonly matchingEngineBorshCoder: BorshCoder;
  readonly tokenRouterBorshCoder: BorshCoder;
  readonly matchingEngineProgram: MatchingEngineProgram;
  readonly pg: Knex | null = null;

  constructor(network: Network, isTest: boolean = false) {
    super(network, false);

    this.rpc = isTest ? 'https://api.devnet.solana.com' : RPCS_BY_CHAIN[this.network].Solana!;
    this.matchingEngineBorshCoder = new BorshCoder(MATCHING_ENGINE_IDL as any);
    this.tokenRouterBorshCoder = new BorshCoder(TOKEN_ROUTER_IDL as any);
    this.matchingEngineProgram = new MatchingEngineProgram(
      new Connection(this.rpc),
      MATCHING_ENGINE_PROGRAM_ID,
      new PublicKey(USDC_MINT)
    );
    this.getSignaturesLimit = 100;
    this.logger = getLogger('fast_transfer_solana');
    // hacky way to not connect to the db in tests
    // this is to allow ci to run without a db
    if (isTest) {
      // Components needed for testing is complete
      return;
    }
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

  // TODO: Modify this so watcher can actually call this function (Add enum for mode)
  async getMessagesByBlock(fromSlot: number, toSlot: number): Promise<string> {
    if (fromSlot > toSlot) throw new Error('solana: invalid block range');

    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);
    const { fromSignature, toSignature, toBlock } = await findFromSignatureAndToSignature(
      this.getConnection(),
      fromSlot,
      toSlot
    );

    let numSignatures = this.getSignaturesLimit;
    let currSignature: string | undefined = fromSignature;

    while (numSignatures === this.getSignaturesLimit) {
      const signatures: ConfirmedSignatureInfo[] = await this.fetchAndProcessMessages(
        currSignature,
        toSignature,
        new PublicKey(MATCHING_ENGINE_PROGRAM_ID)
      );

      // Commented out because there's nothing to test with on devnet yet
      // // Fetch and process messages for tokenRouter
      // const signatures: ConfirmedSignatureInfo[] = await this.fetchAndProcessMessages(
      //   currSignature,
      //   toSignature,
      //   new PublicKey(TOKEN_ROUTER_PROGRAM_ID)
      // );

      numSignatures = signatures.length;
      // We can safely use the last signature from either program as the loop continuation
      // `fetchAndProcessMessages` will check every signature between `currSignature` and `toSignature` for both programs
      // hence no signature will be missed
      // TODO: We should check which one is the later signature and use that as the continuation to reduce duplicated processing
      currSignature = signatures.at(-1)?.signature;
    }

    const lastBlockKey = makeBlockKey(
      toSlot.toString(),
      new Date(toBlock.blockTime! * 1000).toISOString()
    );
    return lastBlockKey;
  }

  // same thing as NTT Solana Watcher
  async fetchAndProcessMessages(
    fromSignature: string | undefined,
    toSignature: string,
    programId: PublicKey
  ): Promise<ConfirmedSignatureInfo[]> {
    let signatures: ConfirmedSignatureInfo[] = await this.getConnection().getSignaturesForAddress(
      programId,
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
          await this.parseInstruction(res, instruction, programId);
        } catch (error) {
          this.logger.error('error:', error);
        }
      }
    }

    return signatures;
  }

  async parseInstruction(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction,
    programId: PublicKey
  ): Promise<ParsedLogs | null> {
    let decodedData: Instruction | null = null;
    if (programId.toBase58() === MATCHING_ENGINE_PROGRAM_ID) {
      decodedData = this.matchingEngineBorshCoder.instruction.decode(
        Buffer.from(instruction.data),
        'base58'
      );
    } else if (programId.toBase58() === TOKEN_ROUTER_PROGRAM_ID) {
      decodedData = this.tokenRouterBorshCoder.instruction.decode(
        Buffer.from(instruction.data),
        'base58'
      );
    }

    const ixName = decodedData?.name;
    if (!ixName) {
      this.logger.debug('decodedData is null');
      return null;
    }

    let fast_transfer: FastTransfer | null = null;
    let auction_offer: AuctionOffer | null = null;
    switch (ixName) {
      case 'placeInitialOfferCctp':
        const data = decodedData?.data;
        if (!data) {
          throw new Error('no data');
        }

        ({ fast_transfer, auction_offer } = await this.parsePlaceInitialOfferCctp(
          res,
          instruction
        ));
        break;
      case 'improveOffer':
        ({ auction_offer } = await this.parseImproveOffer(res, instruction));
        break;
    }

    // returning this for testing purposes
    return { fast_transfer, auction_offer };
  }

  async parsePlaceInitialOfferCctp(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ): Promise<ParsedLogs> {
    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    const fastVaaAccount = accountKeys[accountKeyIndexes[4]];
    const auctionAccount = accountKeys[accountKeyIndexes[7]];

    const auction = await this.matchingEngineProgram.fetchAuction({ address: auctionAccount });
    const fastVaaAcct = await VaaAccount.fetch(
      this.matchingEngineProgram.program.provider.connection,
      fastVaaAccount
    );
    const fastVaaMessage = LiquidityLayerMessage.decode(fastVaaAcct.payload());
    const vaaId = `${fastVaaAcct.emitterInfo().chain}/${Buffer.from(
      fastVaaAcct.emitterInfo().address
    ).toString('hex')}/${fastVaaAcct.emitterInfo().sequence}`;

    const fast_transfer: FastTransfer = {
      fast_transfer_id: vaaId,
      fast_vaa_hash: Buffer.from(fastVaaAcct.digest()).toString('hex'),
      auction_pubkey: auctionAccount.toBase58(),
      amount: fastVaaMessage.fastMarketOrder?.amountIn || 0n,
      initial_offer_time: new Date(fastVaaAcct.timestamp() * 1000),
      src_chain: fastVaaAcct.postedVaaV1.emitterChain,
      dst_chain: fastVaaMessage.fastMarketOrder?.targetChain || 0,
      sender: fastVaaMessage.fastMarketOrder?.sender
        ? Buffer.from(fastVaaMessage.fastMarketOrder.sender).toString('hex')
        : '',
      redeemer: fastVaaMessage.fastMarketOrder?.redeemer
        ? Buffer.from(fastVaaMessage.fastMarketOrder.redeemer).toString('hex')
        : '',
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
    };

    const auction_offer: AuctionOffer = {
      fast_vaa_hash: fast_transfer.fast_vaa_hash,
      start_slot: auction.info?.startSlot ? BigInt(auction.info.startSlot.toString()) : 0n,
      amount_in: auction.info?.amountIn ? BigInt(auction.info.amountIn.toString()) : 0n,
      security_deposit: auction.info?.securityDeposit
        ? BigInt(auction.info.securityDeposit.toString())
        : 0n,
      offer_price: auction.info?.offerPrice ? BigInt(auction.info.offerPrice.toString()) : 0n,
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
    };

    await this.saveFastTransfer(fast_transfer);
    await this.saveAuctionLogs(auction_offer);

    return { fast_transfer, auction_offer };
  }

  async parseImproveOffer(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ): Promise<ParsedLogs> {
    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    const auctionAccount = accountKeys[accountKeyIndexes[1]];

    const auction = await this.matchingEngineProgram.fetchAuction({ address: auctionAccount });

    const auction_offer: AuctionOffer = {
      fast_vaa_hash: Buffer.from(auction.vaaHash).toString('hex'),
      start_slot: auction.info?.startSlot ? BigInt(auction.info.startSlot.toString()) : 0n,
      amount_in: auction.info?.amountIn ? BigInt(auction.info.amountIn.toString()) : 0n,
      security_deposit: auction.info?.securityDeposit
        ? BigInt(auction.info.securityDeposit.toString())
        : 0n,
      offer_price: auction.info?.offerPrice ? BigInt(auction.info.offerPrice.toString()) : 0n,
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
    };

    await this.saveAuctionLogs(auction_offer);

    return { fast_transfer: null, auction_offer };
  }

  async saveFastTransfer(fastTransfer: FastTransfer): Promise<void> {
    // this is to allow ci to run without a db
    if (!this.pg) {
      return;
    }
    this.logger.debug(`saving fast transfer ${fastTransfer.fast_vaa_hash}`);

    // Upsert the fast transfer
    await this.pg('fast_transfers').insert(fastTransfer).onConflict('fast_transfer_id').merge();
  }

  async saveAuctionLogs(auctionLogs: AuctionOffer): Promise<void> {
    // this is to allow ci to run without a db
    if (!this.pg) {
      return;
    }
    this.logger.debug(`saving auction logs for ${auctionLogs.fast_vaa_hash}`);

    await this.pg('auction_logs').insert(auctionLogs);
  }
}
