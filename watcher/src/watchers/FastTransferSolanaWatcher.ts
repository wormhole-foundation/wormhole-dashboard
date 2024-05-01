import { Network } from '@wormhole-foundation/sdk-base';
import { SolanaWatcher } from './SolanaWatcher';
import { MatchingEngineProgram } from '../fastTransfer/matchingEngine';
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
import { BorshCoder, Instruction, BN } from '@coral-xyz/anchor';
import { decodeTransferInstruction } from '@solana/spl-token';

import MATCHING_ENGINE_IDL from '../idls/matching_engine.json';
import TOKEN_ROUTER_IDL from '../idls/token_router.json';
import { RPCS_BY_CHAIN } from '../consts';
import { VaaAccount } from '../fastTransfer/wormhole';
import { LiquidityLayerMessage } from '../fastTransfer/common';
import {
  AuctionOffer,
  FastTransfer,
  FastTransferExecutionInfo,
  FastTransferId,
  FastTransferImprovementInfo,
  FastTransferProtocol,
  FastTransferSettledInfo,
  FastTransferStatus,
  ParsedLogs,
  isOfferArgs,
} from '../fastTransfer/types';
import knex, { Knex } from 'knex';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { getLogger } from '../utils/logger';
import base58 from 'bs58';
import { FAST_TRANSFER_CONTRACTS } from '../fastTransfer/consts';

export class FastTransferSolanaWatcher extends SolanaWatcher {
  readonly rpc: string;
  readonly matchingEngineBorshCoder: BorshCoder;
  readonly tokenRouterBorshCoder: BorshCoder;
  readonly matchingEngineProgram: MatchingEngineProgram;
  readonly pg: Knex | null = null;
  readonly MATCHING_ENGINE_PROGRAM_ID = FAST_TRANSFER_CONTRACTS.Testnet?.MatchingEngine!;
  readonly USDC_MINT = FAST_TRANSFER_CONTRACTS.Testnet?.USDCMint!;
  readonly TOKEN_ROUTER_PROGRAM_ID = FAST_TRANSFER_CONTRACTS.Testnet?.TokenRouter!;
  lastSlot = 0;

  constructor(network: Network, isTest: boolean = false) {
    super(network, false);

    this.rpc = isTest ? 'https://api.devnet.solana.com' : RPCS_BY_CHAIN[this.network].Solana!;
    this.matchingEngineBorshCoder = new BorshCoder(MATCHING_ENGINE_IDL as any);
    this.tokenRouterBorshCoder = new BorshCoder(TOKEN_ROUTER_IDL as any);
    this.matchingEngineProgram = new MatchingEngineProgram(
      new Connection(this.rpc),
      this.MATCHING_ENGINE_PROGRAM_ID,
      new PublicKey(this.USDC_MINT)
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
    let currSignature: string | undefined = fromSignature;
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
      if (batchSignatures[0].signature === currSignature) {
        console.warn('No new signatures fetched, breaking the loop.');
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

    // We want to sort them by chronological order and process them from the oldest to the newest
    const results = await this.getConnection().getTransactions(
      signatures.map((s) => s.signature),
      {
        maxSupportedTransactionVersion: 0,
      }
    );

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
          await this.parseInstruction(res, ix.ix, programId, ix.seq);
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
    programId: PublicKey,
    seq: number
  ): Promise<ParsedLogs | null> {
    const decodedData = this.matchingEngineBorshCoder.instruction.decode(
      Buffer.from(instruction.data),
      'base58'
    );

    const ixName = decodedData?.name;
    if (!decodedData || !ixName) {
      this.logger.debug('decodedData is null');
      return null;
    }

    let fast_transfer: FastTransfer | null = null;
    let auction_offer: AuctionOffer | null = null;
    switch (ixName) {
      case 'place_initial_offer_cctp':
        const data = decodedData?.data;
        if (!data) {
          throw new Error('no data');
        }

        ({ fast_transfer, auction_offer } = await this.parsePlaceInitialOfferCctp(
          res,
          instruction,
          decodedData
        ));
        break;
      case 'improve_offer':
        ({ auction_offer } = await this.parseImproveOffer(res, instruction, decodedData));
        break;
      case 'execute_fast_order_cctp':
        await this.parseExecuteFastOrderCctp(res, instruction);
        break;
      case 'execute_fast_order_local':
        await this.parseExecuteFastOrderLocal(res, instruction);
        break;
      case 'settle_auction_complete':
        console.log('settle_auction_complete', res.transaction.signatures[0]);
        await this.parseSettleAuctionComplete(res, instruction, seq);
        break;
      case 'settle_auction_none_local':
        await this.parseSettleAuctionNoneLocal(res, instruction);
        break;
      case 'settle_auction_none_cctp':
        await this.parseSettleAuctionNoneCctp(res, instruction);
        break;
    }

    // returning this for testing purposes
    return { fast_transfer, auction_offer };
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
    const payer = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[4]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[7]];

    const auction = await this.matchingEngineProgram.fetchAuction({
      address: auctionAccountPubkey,
    });
    if (!auction.info) {
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
    const vaaId = `${fastVaaAccount.emitterInfo().chain}/${Buffer.from(
      fastVaaAccount.emitterInfo().address
    ).toString('hex')}/${fastVaaAccount.emitterInfo().sequence}`;

    let message_protocol: FastTransferProtocol = FastTransferProtocol.NONE;
    let cctp_domain: number | undefined;
    let local_program_id: string | undefined;
    if (auction.targetProtocol.cctp) {
      message_protocol = FastTransferProtocol.CCTP;
      cctp_domain = auction.targetProtocol.cctp.domain;
    } else if (auction.targetProtocol.local) {
      message_protocol = FastTransferProtocol.LOCAL;
      local_program_id = auction.targetProtocol.local.programId.toBase58();
    }

    const fast_transfer: FastTransfer = {
      fast_transfer_id: vaaId,
      fast_vaa_hash: Buffer.from(fastVaaAccount.digest()).toString('hex'),
      auction_pubkey: auctionAccountPubkey.toBase58(),
      amount: fastVaaMessage.fastMarketOrder?.amountIn || 0n,
      initial_offer_time: new Date(fastVaaAccount.timestamp() * 1000),
      src_chain: fastVaaAccount.postedVaaV1.emitterChain,
      dst_chain: fastVaaMessage.fastMarketOrder?.targetChain || 0,
      sender: fastVaaMessage.fastMarketOrder?.sender
        ? Buffer.from(fastVaaMessage.fastMarketOrder.sender).toString('hex')
        : '',
      redeemer: fastVaaMessage.fastMarketOrder?.redeemer
        ? Buffer.from(fastVaaMessage.fastMarketOrder.redeemer).toString('hex')
        : '',
      start_slot: BigInt(startSlot.toString()),
      end_slot: BigInt(startSlot.addn(duration).toString()),
      deadline_slot: BigInt(startSlot.addn(duration).addn(gracePeriod).toString()),
      best_offer_amount: BigInt(decodedData.data.offer_price.toString()),
      best_offer_token: auction.info?.bestOfferToken?.toBase58() || '',
      message_protocol,
      cctp_domain,
      local_program_id,
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
    };

    // create an offer for this auction
    const auction_offer: AuctionOffer = {
      fast_vaa_hash: fast_transfer.fast_vaa_hash,
      payer: payer.toBase58(),
      is_initial_offer: true,
      amount_in: auction.info?.amountIn ? BigInt(auction.info.amountIn.toString()) : 0n,
      security_deposit: auction.info?.securityDeposit
        ? BigInt(auction.info.securityDeposit.toString())
        : 0n,
      offer_price: BigInt(decodedData.data.offer_price.toString()),
      tx_hash: res.transaction.signatures[0],
      timestamp: new Date(res.blockTime! * 1000),
      slot: BigInt(res.slot),
    };

    await this.saveFastTransfer(fast_transfer);
    await this.saveAuctionLogs(auction_offer);

    return { fast_transfer, auction_offer };
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
  ): Promise<ParsedLogs> {
    if (decodedData.data === undefined || !isOfferArgs(decodedData.data)) {
      throw new Error(`[parseImproveOffer] invalid data: ${JSON.stringify(decodedData.data)}`);
    }

    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[1]];

    const auction = await this.matchingEngineProgram.fetchAuction({
      address: auctionAccountPubkey,
    });

    const auction_offer: AuctionOffer = {
      fast_vaa_hash: Buffer.from(auction.vaaHash).toString('hex'),
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
    await this.updateFastTransfer(
      { fast_vaa_hash },
      {
        best_offer_token: best_offer_token || '',
        best_offer_amount: BigInt(decodedData.data.offer_price.toString()),
      }
    );

    await this.saveAuctionLogs(auction_offer);

    return { fast_transfer: null, auction_offer };
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
    const auctionPubkey = await this.matchingEngineProgram.fetchAuction({
      address: auctionAccountPubkey,
    });
    if (!auctionPubkey.info) {
      throw new Error('[computeExecutionData] auction info is missing');
    }

    const vaaAccount = await VaaAccount.fetch(
      this.matchingEngineProgram.program.provider.connection,
      fastVaaAccount
    );
    const { fastMarketOrder } = LiquidityLayerMessage.decode(vaaAccount.payload());

    if (!fastMarketOrder) {
      throw new Error('[computeExecutionData] fast market order is missing');
    }

    const info = auctionPubkey.info;
    const { amountIn, offerPrice } = info;
    const { userReward, penalty } = await this.matchingEngineProgram.computeDepositPenalty(
      info,
      BigInt(tx.slot),
      info.configId
    );
    const userAmount =
      BigInt(amountIn.sub(offerPrice).toString()) - fastMarketOrder.initAuctionFee + userReward;

    return {
      id: { fast_vaa_hash: Buffer.from(vaaAccount.digest()).toString('hex') },
      info: {
        status: FastTransferStatus.EXECUTED,
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
    const payerAccountPubkey = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[4]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[5]];

    const { id, info } = await this.computeExecutionData(
      res,
      payerAccountPubkey,
      auctionAccountPubkey,
      fastVaaAccountPubkey
    );

    await this.updateFastTransfer(id, info);

    // return this for testing purposes
    return info;
  }

  async parseExecuteFastOrderLocal(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ) {
    const accountKeys = res.transaction.message.getAccountKeys().staticAccountKeys;
    const accountKeyIndexes = instruction.accountKeyIndexes;
    const payerAccountPubkey = accountKeys[accountKeyIndexes[0]];
    const fastVaaAccountPubkey = accountKeys[accountKeyIndexes[3]];
    const auctionAccountPubkey = accountKeys[accountKeyIndexes[4]];

    const { id, info } = await this.computeExecutionData(
      res,
      payerAccountPubkey,
      auctionAccountPubkey,
      fastVaaAccountPubkey
    );

    await this.updateFastTransfer(id, info);

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
  ): Promise<{ id: FastTransferId; info: FastTransferSettledInfo }> {
    if (!res.meta?.innerInstructions) {
      throw new Error(
        `[parseSettleAuctionComplete] ${res.transaction.signatures[0]} no inner instructions`
      );
    }

    // somehow the transactions we get cannot resolve the address lookup tables
    // this is a temp way to get the account keys for the transaction until that is fixed
    const accountKeys = await this.getAccountsByParsedTransaction(res.transaction.signatures[0]);
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
    const id = {
      auction_pubkey: auctionAccountPubkey.pubkey.toBase58(),
    };

    const info = {
      status: FastTransferStatus.SETTLED,
      repayment: BigInt(decodedData.data.amount.toString()),
      settle_payer: accountKeys[transferSplIx.accounts[0]].pubkey.toBase58(),
      settle_tx_hash: res.transaction.signatures[0],
      settle_slot: BigInt(res.slot),
      settle_time: new Date(res.blockTime! * 1000),
    };

    await this.updateFastTransfer(id, info);

    return {
      id,
      info,
    };
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
    instruction: MessageCompiledInstruction
  ) {
    // Slow relay is not done yet, will implement after
    throw new Error('[parseSettleAuctionNoneLocal] not implemented');
  }

  async parseSettleAuctionNoneCctp(
    res: VersionedTransactionResponse,
    instruction: MessageCompiledInstruction
  ) {
    // Slow relay is not done yet, will implement after
    throw new Error('[parseSettleAuctionNoneCctp] not implemented');
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

  async updateFastTransfer(
    id: FastTransferId,
    info: FastTransferExecutionInfo | FastTransferSettledInfo | FastTransferImprovementInfo
  ): Promise<void> {
    if (!this.pg) {
      return;
    }

    await this.pg('fast_transfers').where(id).update(info);
  }

  async saveAuctionLogs(auctionLogs: AuctionOffer): Promise<void> {
    // this is to allow ci to run without a db
    if (!this.pg) {
      return;
    }

    this.logger.debug(
      `Attempting to save auction logs for ${auctionLogs.fast_vaa_hash} with data:`,
      auctionLogs
    );

    await this.pg('auction_logs').insert(auctionLogs);
  }
}
