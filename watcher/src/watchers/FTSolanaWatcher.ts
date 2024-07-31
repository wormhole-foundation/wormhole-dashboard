import { Network } from '@wormhole-foundation/sdk-base';
import { SolanaWatcher } from './SolanaWatcher';
import {
  AuctionEntry,
  AuctionInfo,
  MatchingEngineProgram,
} from '@wormhole-foundation/example-liquidity-layer-solana/matchingEngine';
import {
  ConfirmedSignatureInfo,
  Connection,
  MessageCompiledInstruction,
  ParsedMessageAccount,
  PublicKey,
  TransactionInstruction,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { findFromSignatureAndToSignature } from '../utils/solana';
import { makeBlockKey } from '../databases/utils';
import { BorshCoder, Event, EventParser, Instruction } from '@coral-xyz/anchor';
import { decodeTransferInstruction } from '@solana/spl-token';

import MATCHING_ENGINE_IDL from '../idls/matching_engine.json';
import TOKEN_ROUTER_IDL from '../idls/token_router.json';
import { RPCS_BY_CHAIN } from '../consts';
import { VaaAccount } from '@wormhole-foundation/example-liquidity-layer-solana/wormhole';
import { LiquidityLayerMessage } from '@wormhole-foundation/example-liquidity-layer-solana/common';
import {
  AuctionOffer,
  MarketOrder,
  FastTransferUpdate,
  FastTransferAuctionInfo,
  FastTransferExecutionInfo,
  FastTransferId,
  FastTransferAuctionUpdate,
  FastTransferProtocol,
  FastTransferSettledInfo,
  FastTransferStatus,
  ParsedLogs,
  isOfferArgs,
  AuctionUpdated,
  AuctionUpdatedEvent,
} from '../fastTransfer/types';
import knex, { Knex } from 'knex';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { getLogger } from '../utils/logger';
import base58 from 'bs58';
import {
  FAST_TRANSFER_CONTRACTS,
  MatchingEngineProgramId,
  TokenRouterProgramId,
  USDCMintAddress,
} from '../fastTransfer/consts';
import { FastMarketOrder } from '@wormhole-foundation/example-liquidity-layer-definitions';

export class FTSolanaWatcher extends SolanaWatcher {
  readonly network: Network;
  readonly rpc: string;
  readonly matchingEngineBorshCoder: BorshCoder;
  readonly tokenRouterBorshCoder: BorshCoder;
  readonly matchingEngineProgram: MatchingEngineProgram;
  readonly pg: Knex | null = null;
  readonly MATCHING_ENGINE_PROGRAM_ID: MatchingEngineProgramId;
  readonly USDC_MINT: USDCMintAddress;
  readonly TOKEN_ROUTER_PROGRAM_ID: TokenRouterProgramId;
  readonly eventParser: EventParser;

  constructor(network: Network, isTest: boolean = false) {
    super(network, 'ft');

    this.getSignaturesLimit = 100;
    this.network = network;
    this.rpc = isTest ? 'https://api.devnet.solana.com' : RPCS_BY_CHAIN[network].Solana!;
    this.matchingEngineBorshCoder = new BorshCoder(MATCHING_ENGINE_IDL as any);
    this.tokenRouterBorshCoder = new BorshCoder(TOKEN_ROUTER_IDL as any);

    this.MATCHING_ENGINE_PROGRAM_ID = FAST_TRANSFER_CONTRACTS[network]?.Solana?.MatchingEngine!;
    this.USDC_MINT = FAST_TRANSFER_CONTRACTS[network]?.Solana?.USDCMint!;
    this.TOKEN_ROUTER_PROGRAM_ID = FAST_TRANSFER_CONTRACTS[network]?.Solana?.TokenRouter!;

    this.matchingEngineProgram = new MatchingEngineProgram(
      new Connection(this.rpc),
      this.MATCHING_ENGINE_PROGRAM_ID,
      new PublicKey(this.USDC_MINT)
    );
    this.connection = new Connection(this.rpc);
    this.logger = getLogger(`fast_transfer_solana_${network.toLowerCase()}`);
    this.eventParser = new EventParser(
      new PublicKey(this.MATCHING_ENGINE_PROGRAM_ID),
      this.matchingEngineBorshCoder
    );

    // hacky way to not connect to the db in tests
    // this is to allow ci to run without a db
    if (isTest) {
      // Components needed for testing is complete
      return;
    }
    this.pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_FT_USER'),
        password: assertEnvironmentVariable('PG_FT_PASSWORD'),
        database: assertEnvironmentVariable('PG_FT_DATABASE'),
        host: assertEnvironmentVariable('PG_FT_HOST'),
        port: Number(assertEnvironmentVariable('PG_FT_PORT')),
      },
    });
  }

  async getFtMessagesForBlocks(fromSlot: number, toSlot: number): Promise<string> {
    if (fromSlot > toSlot) throw new Error('solana: invalid block range');

    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);
    const { fromSignature, toSignature, toBlock } = await findFromSignatureAndToSignature(
      this.getConnection(),
      fromSlot,
      toSlot
    );

    await this.fetchAndProcessMessagesByBatch(
      fromSignature,
      toSignature,
      new PublicKey(this.MATCHING_ENGINE_PROGRAM_ID)
    );

    const lastBlockKey = makeBlockKey(
      toSlot.toString(),
      new Date(toBlock.blockTime! * 1000).toISOString()
    );
    return lastBlockKey;
  }

  // fetches all the transactionSignatures in a chronological order
  async getTransactionSignatures(
    fromSignature: string,
    toSignature: string,
    programId: PublicKey
  ): Promise<ConfirmedSignatureInfo[]> {
    let numSignatures = this.getSignaturesLimit;
    let currSignature = fromSignature;
    let allSignatures: ConfirmedSignatureInfo[] = [];

    while (numSignatures === this.getSignaturesLimit) {
      const batchSignatures: ConfirmedSignatureInfo[] =
        await this.getConnection().getSignaturesForAddress(programId, {
          before: currSignature,
          until: toSignature,
          limit: this.getSignaturesLimit,
        });

      if (batchSignatures.length === 0) {
        break;
      }

      // Check if the last signature of this batch is the same as the current signature
      // If it is, it means we are not progressing and should break the loop
      // Index is 0 because `getSignaturesForAddress` returns the signatures in descending order
      if (batchSignatures[0].signature === currSignature) {
        this.logger.warn('No new signatures fetched, breaking the loop.');
        break;
      }

      allSignatures.push(...batchSignatures);
      numSignatures = batchSignatures.length;
      // Update currSignature to the last fetched signature in this batch
      currSignature = batchSignatures[batchSignatures.length - 1].signature;
    }

    // Reverse to maintain chronological order
    // `getSignaturesForAddress` returns the signatures in descending order
    return allSignatures.reverse();
  }

  async fetchAndProcessMessagesByBatch(
    fromSignature: string,
    toSignature: string,
    programId: PublicKey
  ) {
    const signatures = await this.getTransactionSignatures(fromSignature, toSignature, programId);
    for (let i = 0; i < signatures.length; i += this.getSignaturesLimit) {
      const batchSignatures = signatures.slice(i, i + this.getSignaturesLimit);
      await this.fetchAndProcessMessages(batchSignatures, programId);
    }
  }

  // same thing as NTT Solana Watcher
  async fetchAndProcessMessages(
    signatures: ConfirmedSignatureInfo[],
    programId: PublicKey
  ): Promise<ConfirmedSignatureInfo[]> {
    if (signatures.length === 0) {
      return [];
    }

    let results = [];

    // Adding a try-catch block because ankr throws unsafeRes,
    try {
      // We want to sort them by chronological order and process them from the oldest to the newest
      results = await this.getConnection().getTransactions(
        signatures.map((s) => s.signature),
        {
          maxSupportedTransactionVersion: 0,
        }
      );
    } catch (error) {
      this.logger.error('error:', error);
      return [];
    }

    // Early return
    if (results.length === 0) {
      this.logger.warn('No transactions found for the provided signatures.');
      return [];
    }

    if (results.length !== signatures.length) {
      throw new Error(`failed to fetch tx for signatures`);
    }

    for (const res of results) {
      if (res?.meta?.err) {
        // skip errored txs
        continue;
      }

      if (!res || !res.blockTime) {
        throw new Error(
          `failed to fetch tx for signature ${res?.transaction.signatures[0] || 'unknown'}`
        );
      }

      const message = res.transaction.message;
      const instructions = message.compiledInstructions;

      // filter out instructions that are not for the program we are interested in
      const programIdIndex = res.transaction.message.staticAccountKeys.findIndex((i) =>
        i.equals(programId)
      );

      const programInstructions = instructions
        .map((ix, seq) => {
          return { ix, seq };
        })
        .filter((i) => i.ix.programIdIndex === programIdIndex);

      for (const ix of programInstructions) {
        try {
          await this.parseInstruction(res, ix.ix, ix.seq);
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
    seq: number
  ): Promise<void> {
    const decodedData = this.matchingEngineBorshCoder.instruction.decode(
      Buffer.from(instruction.data),
      'base58'
    );

    const ixName = decodedData?.name;
    if (!decodedData || !ixName) {
      this.logger.debug('decodedData is null');
      return;
    }

    switch (ixName) {
      case 'place_initial_offer_cctp':
        const data = decodedData?.data;
        if (!data) {
          throw new Error('no data');
        }

        await this.parsePlaceInitialOfferCctp(res, instruction, decodedData);
        break;
      case 'improve_offer':
        await this.parseImproveOffer(res, instruction, decodedData);
        break;
      case 'execute_fast_order_cctp':
        await this.parseExecuteFastOrderCctp(res, instruction);
        break;
      case 'execute_fast_order_local':
        await this.parseExecuteFastOrderLocal(res, instruction);
        break;
      case 'settle_auction_complete':
        await this.parseSettleAuctionComplete(res, instruction, seq);
        break;
      case 'settle_auction_none_local':
        await this.parseSettleAuctionNoneLocal(res, instruction);
        break;
      case 'settle_auction_none_cctp':
        await this.parseSettleAuctionNoneCctp(res, instruction);
        break;
    }
  }

  // This assumes that there is only one signer
  getSigner(res: VersionedTransactionResponse): PublicKey {
    return res.transaction.message.getAccountKeys().staticAccountKeys[0];
  }

  /**
   * This function parses the `placeInitialOfferCctp` instruction.
   * It parses the vaa and auction account for the initial offer data.
   * The auction is created in this instruction so we can get the auction data from the account.
   * The initial offer also creates an offer for the auction so we need to save the offer data.
   */
  async parsePlaceInitialOfferCctp(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction,
    decodedData: Instruction
  ): Promise<ParsedLogs> {
    if (decodedData.data === undefined || !isOfferArgs(decodedData.data)) {
      throw new Error(
        `[parsePlaceInitialOfferCctp] invalid data: ${JSON.stringify(decodedData.data)}`
      );
    }

    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    if (accountKeyIndexes.length < 8) {
      throw new Error('Insufficient account key indexes for parsePlaceInitialOfferCctp');
    }
    const payer = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[4]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[7]];

    const auction = await this.fetchAuction(auctionAccountPubkey.toBase58());
    if (!auction || !auction.info) {
      throw new Error(`[parsePlaceInitialOfferCctp] no auction info`);
    }
    const { configId, startSlot } = auction.info;
    const auctionConfig = await this.matchingEngineProgram.fetchAuctionConfig(configId);
    const { duration, gracePeriod } = auctionConfig.parameters;

    const fastVaaAccount = await VaaAccount.fetch(
      this.matchingEngineProgram.program.provider.connection,
      fastVaaAccountPubkey
    );
    const fastVaaMessage = LiquidityLayerMessage.decode(fastVaaAccount.payload());

    const { message_protocol, cctp_domain, local_program_id } = this.checkMessageProtocols(
      res.meta?.logMessages || []
    );

    if (!fastVaaMessage.fastMarketOrder) {
      throw new Error(
        `[parsePlaceInitialOfferCctp] no fast market order for ${res.transaction.signatures[0]}`
      );
    }

    const fast_transfer: FastTransferAuctionInfo = {
      fast_vaa_hash: Buffer.from(fastVaaAccount.digest()).toString('hex'),
      auction_pubkey: auctionAccountPubkey.toBase58(),
      start_slot: BigInt(startSlot.toString()),
      end_slot: BigInt(startSlot.addn(duration).toString()),
      deadline_slot: BigInt(startSlot.addn(duration).addn(gracePeriod).toString()),
      initial_offer_tx_hash: res.transaction.signatures[0],
      initial_offer_timestamp: new Date(res.blockTime! * 1000),
      best_offer_amount: BigInt(decodedData.data.offer_price.toString()),
      best_offer_token: auction.info.bestOfferToken?.toBase58() || '',
      message_protocol,
      cctp_domain,
      local_program_id,
    };

    const fastVaaHash = Buffer.from(fastVaaAccount.digest()).toString('hex');

    // create an offer for this auction
    const auction_offer: AuctionOffer = {
      fast_vaa_hash: fastVaaHash,
      payer: payer.toBase58(),
      is_initial_offer: true,
      amount_in: auction.info.amountIn ? BigInt(auction.info.amountIn.toString()) : 0n,
      security_deposit: auction.info.securityDeposit
        ? BigInt(auction.info.securityDeposit.toString())
        : 0n,
      offer_price: BigInt(decodedData.data.offer_price.toString()),
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
      slot: BigInt(res.slot),
    };

    await this.saveFastTransferInfo('fast_transfer_auctions', fast_transfer);
    await this.saveAuctionLogs(auction_offer);
    await this.updateMarketOrder({
      fast_vaa_hash: fastVaaHash,
      status: FastTransferStatus.AUCTION,
      fast_vaa_id: `${fastVaaAccount.emitterInfo().chain}/${Buffer.from(
        fastVaaAccount.emitterInfo().address
      ).toString('hex')}/${fastVaaAccount.emitterInfo().sequence}`,
    });

    return { auction: fast_transfer, auction_offer };
  }

  checkMessageProtocols(logs: string[]): {
    message_protocol: FastTransferProtocol;
    cctp_domain: number | undefined;
    local_program_id: string | undefined;
  } {
    const auctionUpdate = this.getAuctionUpdatedFromLogs(logs);
    if (!auctionUpdate) {
      return {
        message_protocol: FastTransferProtocol.NONE,
        cctp_domain: undefined,
        local_program_id: undefined,
      };
    }

    let message_protocol: FastTransferProtocol = FastTransferProtocol.NONE;
    let cctp_domain: number | undefined;
    let local_program_id: string | undefined;

    const { target_protocol } = auctionUpdate;
    if (target_protocol.Cctp) {
      message_protocol = FastTransferProtocol.CCTP;
      cctp_domain = target_protocol.Cctp.domain;
    } else if (target_protocol.Local) {
      message_protocol = FastTransferProtocol.LOCAL;
      local_program_id = target_protocol.Local.program_id.toBase58();
    }

    return {
      message_protocol,
      cctp_domain,
      local_program_id,
    };
  }

  /**
   * This function parses the `improve_offer` instruction
   * We can safely assume that the offer price here is better than the previous offer price since
   * the smart contract will throw an error `CarpingNotAllowed`
   */
  async parseImproveOffer(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction,
    decodedData: Instruction
  ): Promise<AuctionOffer> {
    if (decodedData.data === undefined || !isOfferArgs(decodedData.data)) {
      throw new Error(`[parseImproveOffer] invalid data for ${res.transaction.signatures[0]}`);
    }

    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    if (accountKeyIndexes.length < 2) {
      throw new Error('Insufficient account key indexes for parseImproveOffer');
    }
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[1]];

    const auction = await this.fetchAuction(auctionAccountPubkey.toBase58());
    if (!auction) {
      throw new Error('[parseImproveOffer] auction info is missing');
    }

    const auction_offer: AuctionOffer = {
      fast_vaa_hash: auction.vaaHash,
      payer: this.getSigner(res).toBase58(),
      is_initial_offer: false,
      amount_in: auction.info?.amountIn ? BigInt(auction.info.amountIn.toString()) : 0n,
      security_deposit: auction.info?.securityDeposit
        ? BigInt(auction.info.securityDeposit.toString())
        : 0n,
      offer_price: BigInt(decodedData.data.offer_price.toString()),
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
      slot: BigInt(res.slot),
    };

    const best_offer_token = auction.info?.bestOfferToken?.toBase58();

    // this is fine because if the offer price is higher than current offer price,
    // smart contract will throw an error `CarpingNotAllowed`
    const fast_vaa_hash = Buffer.from(auction.vaaHash).toString('hex');
    await this.updateAuction(
      { fast_vaa_hash },
      {
        best_offer_token: best_offer_token || '',
        best_offer_amount: BigInt(decodedData.data.offer_price.toString()),
      }
    );

    await this.saveAuctionLogs(auction_offer);

    return auction_offer;
  }

  /**
   * This function parses the `executeFastOrderCctp/Local` instruction
   * It parses the vaa and auction account for the execution data.
   * The amount that the user receives is calculated by subtracting the offer price from the amount in
   * If there execution is done after grace_period, the winner incurs a penalty and user is compensated.
   */
  async computeExecutionData(
    tx: VersionedTransactionResponse,
    payerAccount: PublicKey,
    auctionAccountPubkey: PublicKey,
    fastVaaAccount: PublicKey
  ): Promise<{ id: FastTransferId; info: FastTransferExecutionInfo }> {
    const vaaAccount = await VaaAccount.fetch(
      this.matchingEngineProgram.program.provider.connection,
      fastVaaAccount
    );
    const { fastMarketOrder } = LiquidityLayerMessage.decode(vaaAccount.payload());

    if (!fastMarketOrder) {
      throw new Error('[computeExecutionData] fast market order is missing');
    }

    const auction = await this.fetchAuction(auctionAccountPubkey.toBase58());
    if (!auction || !auction.info) {
      throw new Error('[computeExecutionData] auction info is missing');
    }
    const { amountIn, offerPrice } = auction.info;
    const { userReward, penalty } = await this.matchingEngineProgram.computeDepositPenalty(
      auction.info,
      BigInt(tx.slot),
      auction.info.configId
    );
    const userAmount =
      BigInt(amountIn.sub(offerPrice).toString()) - fastMarketOrder.initAuctionFee + userReward;
    const fast_vaa_hash = Buffer.from(vaaAccount.digest()).toString('hex');
    const fast_vaa_id = `${vaaAccount.emitterInfo().chain}/${Buffer.from(
      vaaAccount.emitterInfo().address
    ).toString('hex')}/${vaaAccount.emitterInfo().sequence}`;

    return {
      id: { fast_vaa_hash, fast_vaa_id },
      info: {
        fast_vaa_hash,
        user_amount: userAmount,
        penalty,
        execution_payer: payerAccount.toBase58(),
        execution_time: new Date(tx.blockTime! * 1000),
        execution_tx_hash: tx.transaction.signatures[0],
        execution_slot: BigInt(tx.slot),
      },
    };
  }

  async parseExecuteFastOrderCctp(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ): Promise<FastTransferExecutionInfo> {
    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    if (accountKeyIndexes.length < 6) {
      throw new Error('Insufficient account key indexes for parseExecuteFastOrderCctp');
    }
    const payerAccountPubkey = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[4]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[5]];

    const { id, info } = await this.computeExecutionData(
      res,
      payerAccountPubkey,
      auctionAccountPubkey,
      fastVaaAccountPubkey
    );

    await this.saveFastTransferInfo('fast_transfer_executions', info);
    await this.updateMarketOrder({
      fast_vaa_id: id.fast_vaa_id,
      fast_vaa_hash: id.fast_vaa_hash,
      status: FastTransferStatus.EXECUTED,
    });

    // return this for testing purposes
    return info;
  }

  async parseExecuteFastOrderLocal(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ) {
    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    if (accountKeyIndexes.length < 4) {
      throw new Error('Insufficient account key indexes for parseExecuteFastOrderLocal');
    }
    const payerAccountPubkey = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[2]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[3]];

    const { id, info } = await this.computeExecutionData(
      res,
      payerAccountPubkey,
      auctionAccountPubkey,
      fastVaaAccountPubkey
    );

    await this.saveFastTransferInfo('fast_transfer_executions', info);
    await this.updateMarketOrder({
      fast_vaa_id: id.fast_vaa_id,
      fast_vaa_hash: id.fast_vaa_hash,
      status: FastTransferStatus.EXECUTED,
    });

    // return this for testing purposes
    return info;
  }

  /**
   * This function parses the settleAuctionComplete instruction
   * It parses the inner spl token transfer instruction in the settleAuctionComplete instruction
   * to find out the repayment made to the highest bidder
   * @param seq tells us with ix in the transaction the settleAuctionComplete is
   * this is so we can decode the spl token transfer instruction without having to search for it
   * @returns the repayment made to the highest bidder, if the executor is not the highest bidder,
   * the matching engine deducts `base_fee` from the highest bidder and repays the executor
   */
  async parseSettleAuctionComplete(
    res: VersionedTransactionResponse,
    ix: MessageCompiledInstruction,
    seq: number
  ): Promise<FastTransferSettledInfo> {
    if (!res.meta?.innerInstructions) {
      throw new Error(
        `[parseSettleAuctionComplete] ${res.transaction.signatures[0]} no inner instructions`
      );
    }

    // somehow the transactions we get cannot resolve the address lookup tables
    // this is a temp way to get the account keys for the transaction until that is fixed
    const accountKeys = await this.getAccountsByParsedTransaction(res.transaction.signatures[0]);
    if (accountKeys.length < 6) {
      throw new Error('Insufficient account key indexes for parseSettleAuctionComplete');
    }
    const executorTokenAccountPubkey = accountKeys[ix.accountKeyIndexes[1]];
    const bestOfferTokenAccountPubkey = accountKeys[ix.accountKeyIndexes[2]];
    const auctionAccountPubkey = accountKeys[ix.accountKeyIndexes[5]];

    // if the executor token account is not the same as the best offer token account
    // the first transfer is to repay the executor the base fee
    let repaymentIxSeq = 0;
    if (executorTokenAccountPubkey !== bestOfferTokenAccountPubkey) {
      repaymentIxSeq = 1;
    }

    // indexes in the inner instructions are unique so we can assume there will be 1 inner instruction
    const innerIx = res.meta.innerInstructions.filter((i) => i.index === seq)[0];
    const transferSplIx = innerIx.instructions[repaymentIxSeq];

    const decodedData = decodeTransferInstruction(
      new TransactionInstruction({
        keys: transferSplIx.accounts.map((i) => {
          return {
            pubkey: accountKeys[i].pubkey,
            isSigner: res.transaction.message.isAccountSigner(i),
            isWritable: res.transaction.message.isAccountWritable(i),
          };
        }),
        programId: accountKeys[transferSplIx.programIdIndex].pubkey,
        data: Buffer.from(base58.decode(transferSplIx.data)),
      })
    );

    // we can use `auction_pubkey` to know which fast_transfer this is for.
    // if there is a auction to settle, the auction must exist. And the pubkey
    // will be in the db since we parse everything chronologically
    const fast_vaa_hash = await this.getFastVaaHashFromAuctionPubkey(auctionAccountPubkey.pubkey);

    const info = {
      fast_vaa_hash: fast_vaa_hash,
      repayment: BigInt(decodedData.data.amount.toString()),
      settle_payer: accountKeys[transferSplIx.accounts[0]].pubkey.toBase58(),
      settle_tx_hash: res.transaction.signatures[0],
      settle_slot: BigInt(res.slot),
      settle_time: new Date(res.blockTime! * 1000),
    };

    await this.saveFastTransferInfo('fast_transfer_settlements', info);
    await this.updateMarketOrder({
      fast_vaa_hash,
      status: FastTransferStatus.SETTLED,
    });

    return info;
  }

  async getAccountsByParsedTransaction(txHash: string): Promise<ParsedMessageAccount[]> {
    const tx = await this.getConnection().getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      throw new Error(`[getAccountsByParsedTransaction] unable to get transaction ${txHash}`);
    }

    return tx.transaction.message.accountKeys;
  }

  async parseSettleAuctionNoneLocal(
    res: VersionedTransactionResponse,
    ix: MessageCompiledInstruction
  ): Promise<FastTransferSettledInfo> {
    const accountKeys = await this.getAccountsByParsedTransaction(res.transaction.signatures[0]);
    const accountKeyIndexes = ix.accountKeyIndexes;
    if (accountKeyIndexes.length < 7) {
      throw new Error('Insufficient account key indexes for parseSettleAuctionNoneLocal');
    }
    const payer = accountKeys[accountKeyIndexes[0]];
    const auction = accountKeys[accountKeyIndexes[6]];

    const fast_vaa_hash = await this.getFastVaaHashFromAuctionPubkey(auction.pubkey);

    const info = {
      fast_vaa_hash: fast_vaa_hash,
      // No one executed anything so no repayment
      repayment: 0n,
      settle_payer: payer.pubkey.toBase58(),
      settle_tx_hash: res.transaction.signatures[0],
      settle_slot: BigInt(res.slot),
      settle_time: new Date(res.blockTime! * 1000),
    };

    await this.saveFastTransferInfo('fast_transfer_settlements', info);
    await this.updateMarketOrder({
      fast_vaa_hash,
      status: FastTransferStatus.SETTLED,
    });

    return info;
  }

  async parseSettleAuctionNoneCctp(
    res: VersionedTransactionResponse,
    ix: MessageCompiledInstruction
  ): Promise<FastTransferSettledInfo> {
    const accountKeys = await this.getAccountsByParsedTransaction(res.transaction.signatures[0]);
    const accountKeyIndexes = ix.accountKeyIndexes;

    if (accountKeyIndexes.length < 9) {
      throw new Error('Insufficient account key indexes for parseSettleAuctionNoneCctp');
    }

    const payer = accountKeys[accountKeyIndexes[0]];
    const auction = accountKeys[accountKeyIndexes[8]];

    const fast_vaa_hash = await this.getFastVaaHashFromAuctionPubkey(auction.pubkey);

    const info = {
      fast_vaa_hash: fast_vaa_hash,
      // No one executed anything so no repayment
      repayment: 0n,
      settle_payer: payer.pubkey.toBase58(),
      settle_tx_hash: res.transaction.signatures[0],
      settle_slot: BigInt(res.slot),
      settle_time: new Date(res.blockTime! * 1000),
    };

    await this.saveFastTransferInfo('fast_transfer_settlements', info);

    return info;
  }

  /*
   * `fetchAuction` fetches the auction from the chain first
   * if `auctionAccount` is not null, decode it using borsh program and return
   * otherwise, fetch the auction from the auction history
   * if no auction is found even from history, return null
   */
  async fetchAuction(pubkey: string): Promise<{
    vaaHash: string;
    info: AuctionInfo | null;
  } | null> {
    const auctionAccount = await this.connection?.getAccountInfo(new PublicKey(pubkey));

    if (auctionAccount) {
      const auctionInfo = this.matchingEngineBorshCoder.accounts.decode(
        'Auction',
        auctionAccount.data
      );
      // We need to do this manually because the account info given is in snake_case
      return {
        vaaHash: Buffer.from(auctionInfo.vaa_hash).toString('hex'),
        info: {
          configId: auctionInfo.info.config_id,
          custodyTokenBump: auctionInfo.info.custody_token_bump,
          vaaSequence: auctionInfo.info.vaa_sequence,
          sourceChain: auctionInfo.info.source_chain,
          bestOfferToken: auctionInfo.info.best_offer_token,
          initialOfferToken: auctionInfo.info.initial_offer_token,
          startSlot: auctionInfo.info.start_slot,
          amountIn: auctionInfo.info.amount_in,
          securityDeposit: auctionInfo.info.security_deposit,
          offerPrice: auctionInfo.info.offer_price,
          redeemerMessageLen: auctionInfo.info.redeemer_message_len,
          destinationAssetInfo: auctionInfo.info.destination_asset_info,
        },
      };
    }

    const auction = await this.fetchAuctionFromHistory(pubkey);

    if (!auction) {
      this.logger.error(`[fetchAuction] no auction found for ${pubkey}`);
      return null;
    }

    return {
      vaaHash: Buffer.from(auction.vaaHash).toString('hex'),
      info: auction.info,
    };
  }

  /*
   * `getAuctionUpdatedFromLogs` fetches the auction updated event from the logs
   * it's used to get the auction info from the auction updated event
   * We only need `AuctionUpdated` event for now. If we need more events in the future, we can add them here
   */
  getAuctionUpdatedFromLogs(logs: string[]): AuctionUpdated | null {
    const parsedLogs = this.eventParser.parseLogs(logs);
    for (let event of parsedLogs) {
      if (this.isAuctionUpdatedEvent(event)) {
        return event.data;
      }
    }
    return null;
  }

  /*
   * `isAuctionUpdatedEvent` is a type guard that checks if the event is an `AuctionUpdated` event
   */
  isAuctionUpdatedEvent(event: Event): event is AuctionUpdatedEvent {
    return event.name === 'AuctionUpdated' && event.data !== null && typeof event.data === 'object';
  }

  /*
   * `fetchAuctionFromHistory` fetches the auction from the auction history
   * if there is a mapping in the db, we fetch the auction from the auction history using the mapping
   * otherwise, we index to the latest auction history index and fetch the auction from the auction history
   */
  async fetchAuctionFromHistory(pubkey: string): Promise<AuctionEntry | null> {
    const auctionHistoryPubkey = await this.getAuctionHistoryMapping(pubkey);

    if (auctionHistoryPubkey) {
      const index = BigInt(auctionHistoryPubkey.index);
      const auctionHistory = await this.matchingEngineProgram.fetchAuctionHistory(index);

      return (
        auctionHistory.data.find((entry) => {
          const auctionPk = this.matchingEngineProgram.auctionAddress(entry.vaaHash);
          return auctionPk.toBase58() === pubkey;
        }) || null
      );
    }

    return await this.indexAuctionHistory(pubkey);
  }

  /*
   * `indexAuctionHistory` fetches all the auction history records from the matching engine
   * starting from the latest index that has been indexed in the database
   */
  async indexAuctionHistory(pubkey: string): Promise<AuctionEntry | null> {
    let latestAuctionHistoryIndex = await this.getDbLatestAuctionHistoryIndex();
    const auctionHistories = [];

    let foundAllAuctionHistory = false;
    while (!foundAllAuctionHistory) {
      try {
        const auctionHistory = await this.matchingEngineProgram.fetchAuctionHistory(
          latestAuctionHistoryIndex
        );
        auctionHistories.push(auctionHistory);
        latestAuctionHistoryIndex++;
      } catch (error) {
        // if no more auction history records to fetch or an error occurred, break the loop
        foundAllAuctionHistory = true;
      }
    }

    let auction: AuctionEntry | null = null;

    const mapping = auctionHistories.flatMap((auctionHistory) => {
      return auctionHistory.data.map((entry) => {
        const auctionPk = this.matchingEngineProgram.auctionAddress(entry.vaaHash);

        if (auctionPk.toBase58() === pubkey) {
          auction = entry;
        }
        return {
          auction_pubkey: auctionPk.toBase58(),
          index: BigInt(auctionHistory.header.id.toString()),
        };
      });
    });

    await this.saveAuctionHistoryMapping(mapping);

    return auction;
  }
  async getDbLatestAuctionHistoryIndex(): Promise<bigint> {
    if (!this.pg) {
      this.logger.debug('No database connection, returning 0');
      return 0n;
    }
    try {
      const result = await this.pg('auction_history_mapping').max('index as maxIndex').first();
      this.logger.debug('Latest auction history index query result:', result);
      const maxIndex = result && result.maxIndex !== null ? BigInt(result.maxIndex) : 0n;
      this.logger.info(`Latest auction history index: ${maxIndex}`);
      return maxIndex;
    } catch (error) {
      this.logger.error('Failed to fetch the largest index from auction_history_mapping:', error);
      throw new Error('Database query failed');
    }
  }

  async getAuctionHistoryMapping(auction: string): Promise<{
    auction: string;
    auction_pubkey: string;
    index: bigint;
  }> {
    if (!this.pg) {
      this.logger.debug('No database connection, returning default mapping');
      return { auction, auction_pubkey: '', index: 0n };
    }
    try {
      const result = await this.pg('auction_history_mapping')
        .where({ auction_pubkey: auction })
        .first();
      this.logger.debug(`Auction history mapping for ${auction}:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching auction history mapping for ${auction}:`, error);
      throw error;
    }
  }

  async saveAuctionHistoryMapping(
    mappings: { auction_pubkey: string; index: bigint }[]
  ): Promise<void> {
    if (!this.pg) {
      this.logger.debug('No database connection, skipping saveAuctionHistoryMapping');
      return;
    }
    try {
      const result = await this.pg('auction_history_mapping')
        .insert(mappings)
        .onConflict('auction_pubkey')
        .merge();
      this.logger.info(`Saved ${mappings.length} auction history mappings. Result:`, result);
    } catch (error) {
      this.logger.error('Error saving auction history mappings:', error);
      throw error;
    }
  }

  async saveFastTransfer(fastTransfer: MarketOrder): Promise<void> {
    if (!this.pg) {
      this.logger.debug('No database connection, skipping saveFastTransfer');
      return;
    }
    this.logger.debug(`Saving fast transfer ${fastTransfer.fast_vaa_hash}`);
    try {
      const result = await this.pg('fast_transfers')
        .insert(fastTransfer)
        .onConflict('fast_vaa_id')
        .merge();
      this.logger.info(`Saved fast transfer ${fastTransfer.fast_vaa_hash}. Result:`, result);
    } catch (error) {
      this.logger.error(`Error saving fast transfer ${fastTransfer.fast_vaa_hash}:`, error);
      throw error;
    }
  }

  async updateMarketOrder(update: FastTransferUpdate): Promise<void> {
    if (!this.pg) {
      this.logger.debug('No database connection, skipping updateMarketOrder');
      return;
    }
    try {
      const result = await this.pg('market_orders')
        .insert(update)
        .onConflict('fast_vaa_hash')
        .merge();
      this.logger.info(`Updated market order ${update.fast_vaa_id}. Result:`, result);
    } catch (error) {
      this.logger.error('Update data that failed:', update);
      throw error;
    }
  }

  async updateAuction(id: FastTransferId, update: FastTransferAuctionUpdate): Promise<void> {
    if (!this.pg) {
      this.logger.debug('No database connection, skipping updateAuction');
      return;
    }
    try {
      const result = await this.pg('fast_transfer_auctions').where(id).update(update);
      this.logger.info(`Updated auction ${id.fast_vaa_hash}. Result:`, result);
    } catch (error) {
      this.logger.error(`Error updating auction ${id.fast_vaa_hash}:`, error);
      throw error;
    }
  }

  async getFastVaaHashFromAuctionPubkey(auctionPubkey: PublicKey): Promise<string> {
    if (!this.pg) {
      this.logger.debug(
        'No database connection, returning empty string for getFastVaaHashFromAuctionPubkey'
      );
      return '';
    }
    try {
      const result = await this.pg('fast_transfer_auctions')
        .where({ auction_pubkey: auctionPubkey.toBase58() })
        .first();
      this.logger.debug(
        `Fast VAA hash for auction pubkey ${auctionPubkey.toBase58()}:`,
        result?.fast_vaa_hash
      );
      return result?.fast_vaa_hash || '';
    } catch (error) {
      this.logger.error(
        `Error fetching Fast VAA hash for auction pubkey ${auctionPubkey.toBase58()}:`,
        error
      );
      throw error;
    }
  }

  async saveFastTransferInfo(
    table: string,
    info:
      | FastMarketOrder
      | FastTransferAuctionInfo
      | FastTransferExecutionInfo
      | FastTransferSettledInfo
  ): Promise<void> {
    if (!this.pg) {
      this.logger.debug(`No database connection, skipping saveFastTransferInfo for table ${table}`);
      return;
    }
    try {
      const result = await this.pg(table).insert(info);
      this.logger.info(`Saved fast transfer info to table ${table}. Result:`, result);
    } catch (error) {
      this.logger.error(`Error saving fast transfer info to table ${table}:`, error);
      throw error;
    }
  }

  async saveAuctionLogs(auctionLogs: AuctionOffer): Promise<void> {
    if (!this.pg) {
      this.logger.debug('No database connection, skipping saveAuctionLogs');
      return;
    }
    this.logger.debug(`Attempting to save auction logs for ${auctionLogs.fast_vaa_hash}`);
    try {
      const result = await this.pg('auction_logs').insert(auctionLogs);
      this.logger.info(`Saved auction logs for ${auctionLogs.fast_vaa_hash}. Result:`, result);
    } catch (error) {
      this.logger.error(`Error saving auction logs for ${auctionLogs.fast_vaa_hash}:`, error);
      throw error;
    }
  }
}
