import {
  Connection,
  ParsedMessageAccount,
  PublicKey,
  VersionedTransactionResponse,
  MessageCompiledInstruction,
  ParsedAccountData,
} from '@solana/web3.js';
import { BorshCoder } from '@coral-xyz/anchor';
import { Network } from '@wormhole-foundation/sdk-base';
import { FAST_TRANSFER_CONTRACTS } from '../consts';
import SWAP_LAYER_IDL from '../../idls/swap_layer.json';
import { TransferCompletion } from '../types';
import {
  blockTimeToDate,
  getTokenBalanceChange,
} from '@wormhole-foundation/wormhole-monitor-common';

const ACCOUNT_NOT_FOUND = 'Account not found';
const BLOCKTIME_NOT_FOUND = 'Blocktime not found';
const INSUFFICIENT_ACCOUNTS = 'Account length insufficient';

export class SwapLayerParser {
  private readonly swapLayerBorshCoder: BorshCoder;
  public readonly SWAP_LAYER_PROGRAM_ID: PublicKey;
  private readonly USDC_MINT: PublicKey;
  private readonly connection: Connection;

  constructor(network: Network, connection: Connection) {
    this.connection = connection;
    this.SWAP_LAYER_PROGRAM_ID = new PublicKey(
      FAST_TRANSFER_CONTRACTS[network]?.Solana?.SwapLayer ||
      'SwapLayer1111111111111111111111111111111111'
    );
    this.USDC_MINT = new PublicKey(
      FAST_TRANSFER_CONTRACTS[network]?.Solana?.USDCMint ||
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    );
    this.swapLayerBorshCoder = new BorshCoder(SWAP_LAYER_IDL as any);
  }

  // === main logic ===

  /**
   * Processes a single transaction to parse relevant instructions.
   *
   * @param transaction - The Solana transaction response containing the instruction.
   *
   * @returns A `TransferCompletion` object containing parsed details from the transaction,
   *   or `null` if no relevant instructions were found.
   */
  private async processTransaction(
    transaction: VersionedTransactionResponse
  ): Promise<TransferCompletion[]> {
    const sig = transaction.transaction.signatures[0];
    const programInstructions = this.getProgramInstructions(transaction);

    const results = await Promise.all(
      programInstructions.map(async ({ ix }) => {
        const decoded = this.swapLayerBorshCoder.instruction.decode(Buffer.from(ix.data));
        if (!decoded) return null;

        try {
          switch (decoded.name) {
            case 'complete_swap_direct':
            case 'complete_swap_relay':
            case 'complete_swap_payload':
              return await this.parseSwapInstruction(transaction, ix, decoded.name);

            case 'complete_transfer_direct':
            case 'complete_transfer_relay':
            case 'complete_transfer_payload':
              return await this.parseTransferInstruction(transaction, ix, decoded.name);

            case 'release_inbound':
              return await this.parseReleaseInbound(transaction, ix, decoded.name);

            default:
              // Skip unknown instructions
              // we will not log when there are unknown instructions to prevent log congestion
              return null;
          }
        } catch (error) {
          console.error(`Error processing ${decoded.name} in transaction ${sig}:`, error);
          // Continue to the next instruction if there's an error
          return null;
        }
      })
    );

    // Filter out any null results
    return results.filter((result): result is TransferCompletion => result !== null);
  }

  /**
   * Fetches and processes a single transaction by its signature. This is only used for testing for now.
   *
   * @param signature - The signature of the transaction to fetch and process.
   *
   * @returns An array of `TransferCompletion` objects containing parsed details from the transaction.
   *   If no relevant instructions were found, an empty array is returned.
   */
  async parseTransaction(signature: string): Promise<TransferCompletion[]> {
    const transaction = await this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction) return [];

    return this.processTransaction(transaction);
  }

  /**
   * Fetches and processes multiple transactions in a batch. This should be used in production env for better optimization.
   *
   * @param signatures - An array of transaction signatures to fetch and process.
   *
   * @returns An array of `TransferCompletion` objects containing parsed details from each transaction.
   *   If a transaction doesn't contain relevant instructions or an error occurs, it will be omitted from the result array.
   */
  async parseTransactions(signatures: string[]): Promise<TransferCompletion[]> {
    const transactions = await this.connection.getTransactions(signatures, {
      maxSupportedTransactionVersion: 0,
    });

    // Filter out null transactions
    const nonNullTransactions = transactions.filter(
      (tx): tx is VersionedTransactionResponse => tx !== null && !tx.meta?.err
    );

    // Process each transaction and gather the results
    const promises = nonNullTransactions.map(async (tx) => await this.processTransaction(tx));

    const results = await Promise.all(promises);

    // Flatten the array and filter out any null values
    return results.flat().filter((res): res is TransferCompletion => res !== null);
  }
  // === parsing logic ===

  /**
   * Parses a swap instruction from a Solana transaction
   *
   * @param transaction - The Solana transaction response containing the instruction.
   * @param ix - The compiled instruction to parse within the transaction.
   * @param instructionName - The type of swap instruction, which can be one of:
   * `complete_swap_direct`, `complete_swap_payload`, `complete_swap_relay`
   *
   * @returns A `TransferCompletion` object containing details about the swap, such as
   *   recipient, fill account, output token, and amount, or `null` if the instruction
   *   cannot be processed.
   *
   * @throws Will throw an error if the transaction block time is not found, the number of
   *   accounts in the transaction is insufficient, or if the required account information
   *   (recipient or fill account) is missing.
   */
  private async parseSwapInstruction(
    transaction: VersionedTransactionResponse,
    ix: MessageCompiledInstruction,
    instructionName: 'complete_swap_direct' | 'complete_swap_payload' | 'complete_swap_relay'
  ): Promise<TransferCompletion | null> {
    const sig = transaction.transaction.signatures[0];
    const blockTime = this.throwIfBlocktimeNotFound(transaction);

    const accounts = await this.getAccountsByParsedTransaction(sig);
    const minRequiredAccounts = 19;

    if (accounts.length < minRequiredAccounts) {
      throw new Error(`${INSUFFICIENT_ACCOUNTS} for ${instructionName} in ${sig}`);
    }

    const fillAccountIndex = 2;
    const stagedInboundIndex = 7;
    const dstMintIndex = 12;
    const recipientIndex = 18;

    const recipient = accounts[ix.accountKeyIndexes[recipientIndex]].pubkey.toBase58();
    const outputToken = accounts[ix.accountKeyIndexes[dstMintIndex]].pubkey.toBase58();

    const tokenBalance =
      instructionName !== 'complete_swap_payload'
        ? getTokenBalanceChange(transaction, recipient, outputToken)
        : 0n;

    const stagedInbound =
      instructionName === 'complete_swap_payload'
        ? accounts[ix.accountKeyIndexes[stagedInboundIndex]].pubkey.toBase58()
        : undefined;

    return {
      fill_id: accounts[ix.accountKeyIndexes[fillAccountIndex]].pubkey.toBase58(),
      output_token: outputToken,
      recipient: recipient,
      redeem_time: instructionName === 'complete_swap_payload' ? null : blockTimeToDate(blockTime),
      output_amount: tokenBalance,
      staged_inbound: stagedInbound,
      tx_hash: sig,
      relaying_fee: 0n,
    };
  }

  /**
   * Parses a transfer instruction from a Solana transaction
   *
   * @param transaction - The Solana transaction response containing the instruction.
   * @param ix - The compiled instruction to parse within the transaction.
   * @param instructionName - The type of transfer instruction, which can be one of:
   *   'complete_transfer_direct', 'complete_transfer_payload', or 'complete_transfer_relay'.
   *
   * @returns A `TransferCompletion` object containing details about the transfer, such as
   *   recipient, fill account, output token, and amount, or `null` if the instruction
   *   configuration is not found.
   *
   * @throws Will throw an error if the transaction block time is not found, the number of
   *   accounts in the transaction is insufficient, or if the required account information
   *   (recipient or fill account) is missing.
   */ private async parseTransferInstruction(
    transaction: VersionedTransactionResponse,
    ix: MessageCompiledInstruction,
    instructionName:
      | 'complete_transfer_direct'
      | 'complete_transfer_payload'
      | 'complete_transfer_relay'
  ): Promise<TransferCompletion | null> {
    const sig = transaction.transaction.signatures[0];
    if (!transaction.blockTime) {
      throw new Error(`Transaction block time not found: ${sig}`);
    }

    const { fillAccountIndex, recipientIndex } = this.getInstructionConfig(instructionName);

    if (ix.accountKeyIndexes.length <= recipientIndex) {
      throw new Error(`${INSUFFICIENT_ACCOUNTS} for ${instructionName} in ${sig}`);
    }

    const recipient = this.getAccountKey(transaction, ix, recipientIndex);
    if (!recipient) {
      throw new Error(
        `${ACCOUNT_NOT_FOUND}: recipient for ${instructionName} in transaction ${sig}`
      );
    }

    const tokenBalance =
      instructionName !== 'complete_transfer_payload'
        ? getTokenBalanceChange(transaction, recipient.toBase58(), this.USDC_MINT.toBase58())
        : 0n;

    const relayingFee = instructionName === 'complete_transfer_relay'
      ? getTokenBalanceChange(transaction, this.getAccountKey(transaction, ix, 6)?.toBase58() || '', this.USDC_MINT.toBase58()) : 0n;

    const fillAccount = this.getAccountKey(transaction, ix, fillAccountIndex);
    if (!fillAccount) {
      throw new Error(`${ACCOUNT_NOT_FOUND}: fill for ${instructionName} in transaction ${sig}`);
    }

    return {
      recipient: recipient.toBase58(),
      tx_hash: sig,
      relaying_fee: relayingFee,
      fill_id: fillAccount.toBase58(),
      output_token: this.USDC_MINT.toBase58(),
      redeem_time: instructionName === 'complete_transfer_payload' ? null : blockTimeToDate(transaction.blockTime),
      output_amount: tokenBalance,
      staged_inbound:
        instructionName === 'complete_transfer_payload'
          ? this.getAccountKey(transaction, ix, 8)?.toBase58()
          : undefined,
    };
  }

  /**
   * Parses a 'release_inbound' instruction from a Solana transaction
   *
   * @param transaction - The Solana transaction response containing the instruction.
   * @param ix - The compiled instruction to parse within the transaction.
   * @param instructionName - The name of the instruction, which can be of `release_inbound`
   *
   * @returns A `TransferCompletion` object containing details about the release inbound process,
   *   such as recipient, output token, and amount, or `null` if the instruction cannot be processed.
   *
   * @throws Will throw an error if the transaction block time is not found, the number of
   *   accounts in the transaction is insufficient, or if the required account information
   *   (destination token account, mint) is missing or not in the expected format.
   */
  private async parseReleaseInbound(
    transaction: VersionedTransactionResponse,
    ix: MessageCompiledInstruction,
    instructionName: string
  ): Promise<TransferCompletion | null> {
    const sig = transaction.transaction.signatures[0];
    const blockTime = this.throwIfBlocktimeNotFound(transaction);

    if (ix.accountKeyIndexes.length < 6) {
      throw new Error(`${INSUFFICIENT_ACCOUNTS} for ${instructionName} in ${sig}`);
    }

    const stagedInboundIndex = 2;
    const dstTokenAccIndex = 3;
    const mintIndex = 5;

    const dstTokenAccount = this.getAccountKey(transaction, ix, dstTokenAccIndex);
    if (!dstTokenAccount) {
      throw new Error(`${ACCOUNT_NOT_FOUND}: dstTokenAccount for ${instructionName} in {sig}`);
    }

    const parsedTA = await this.connection.getParsedAccountInfo(dstTokenAccount);

    if (!parsedTA.value || !('parsed' in parsedTA.value.data)) {
      throw new Error('Unable to parse release_inbound token account owner.');
    }

    const parsedData = parsedTA.value.data as ParsedAccountData;
    const recipient = new PublicKey(parsedData.parsed.info.owner);
    const mint = this.getAccountKey(transaction, ix, mintIndex);

    if (!mint) {
      throw new Error(`${ACCOUNT_NOT_FOUND}: mint for ${instructionName} in {sig}`);
    }

    return {
      tx_hash: sig,
      relaying_fee: 0n,
      fill_id: '',
      output_token: mint.toBase58(),
      recipient: recipient.toBase58(),
      redeem_time: blockTimeToDate(blockTime),
      output_amount: getTokenBalanceChange(transaction, recipient.toBase58(), mint.toBase58()),
      staged_inbound: this.getAccountKey(transaction, ix, stagedInboundIndex)?.toBase58(),
    };
  }

  // === helper functions for sol parser ===

  private getProgramInstructions(transaction: VersionedTransactionResponse) {
    const message = transaction.transaction.message;
    const programIdIndex = message.staticAccountKeys.findIndex((i) =>
      i.equals(this.SWAP_LAYER_PROGRAM_ID)
    );
    return message.compiledInstructions
      .map((ix, seq) => ({ ix, seq }))
      .filter((i) => i.ix.programIdIndex === programIdIndex);
  }

  private getAccountKey(
    transaction: VersionedTransactionResponse,
    ix: MessageCompiledInstruction,
    accountIndex: number
  ): PublicKey | null {
    const accountKeyIndex = ix.accountKeyIndexes[accountIndex];
    return accountKeyIndex !== undefined
      ? transaction.transaction.message.getAccountKeys().staticAccountKeys[accountKeyIndex]
      : null;
  }

  private getInstructionConfig(
    instructionName:
      | 'complete_transfer_direct'
      | 'complete_transfer_payload'
      | 'complete_transfer_relay'
  ) {
    switch (instructionName) {
      case 'complete_transfer_direct':
        return { fillAccountIndex: 1, recipientIndex: 8 };
      case 'complete_transfer_relay':
        return { fillAccountIndex: 2, recipientIndex: 10 };
      case 'complete_transfer_payload':
        return { fillAccountIndex: 3, recipientIndex: 10 };
    }
  }

  async getAccountsByParsedTransaction(txHash: string): Promise<ParsedMessageAccount[]> {
    const tx = await this.connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      throw new Error(`[getAccountsByParsedTransaction] unable to get transaction ${txHash}`);
    }
    return tx.transaction.message.accountKeys;
  }

  throwIfBlocktimeNotFound(transaction: VersionedTransactionResponse): number {
    if (!transaction.blockTime)
      throw new Error(`${BLOCKTIME_NOT_FOUND}: ${transaction.transaction.signatures[0]}`);

    return transaction.blockTime;
  }
}
