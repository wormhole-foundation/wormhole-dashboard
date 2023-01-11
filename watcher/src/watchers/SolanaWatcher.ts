import { getPostedMessage } from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole';
import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  Commitment,
  Connection,
  PublicKey,
  SolanaJSONRPCError,
  VersionedBlockResponse,
} from '@solana/web3.js';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { isLegacyMessage, normalizeCompileInstruction } from '../utils/solana';
import { Watcher } from './Watcher';

const WORMHOLE_PROGRAM_ID = CONTRACTS.MAINNET.solana.core;
const COMMITMENT: Commitment = 'finalized';
const GET_SIGNATURES_LIMIT = 1000;

export class SolanaWatcher extends Watcher {
  connection: Connection;
  getSignaturesLimit = GET_SIGNATURES_LIMIT; // modifiable in tests

  constructor() {
    super('solana');
    this.connection = new Connection(RPCS_BY_CHAIN.solana!, COMMITMENT);

    // can be arbitrarily large since getMessagesForBlocks handles pagination internally
    this.maximumBatchSize = 100000;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    return this.connection.getSlot();
  }

  async getMessagesForBlocks(fromSlot: number, toSlot: number): Promise<VaasByBlock> {
    if (fromSlot > toSlot) throw new Error('solana: invalid block range');
    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);
    const vaasByBlock: VaasByBlock = {};

    // get transaction bounds, fromSignature occurs after toSignature because getSignaturesForAddress walks backwards
    const toBlock = await this.connection.getBlock(toSlot, { maxSupportedTransactionVersion: 0 });
    if (!toBlock || !toBlock.blockTime) throw new Error(`solana: failed to fetch block ${toSlot}`);
    const fromSignature = toBlock.transactions.at(-1)?.transaction.signatures[0];

    let fromBlock: VersionedBlockResponse | null = null;
    try {
      fromBlock = await this.connection.getBlock(fromSlot, { maxSupportedTransactionVersion: 0 });
    } catch (e) {
      if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
        // failed to get confirmed block: Slot was skipped, or missing in long-term storage
        return this.getMessagesForBlocks(fromSlot + 1, toSlot);
      } else {
        throw e;
      }
    }
    if (!fromBlock || !fromBlock.blockTime) return this.getMessagesForBlocks(fromSlot + 1, toSlot);
    const toSignature = fromBlock.transactions[0].transaction.signatures[0];

    // get all core bridge signatures between fromTransaction and toTransaction
    let numSignatures = this.getSignaturesLimit;
    let currSignature = fromSignature;
    while (numSignatures === this.getSignaturesLimit) {
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(WORMHOLE_PROGRAM_ID),
        {
          before: currSignature,
          until: toSignature,
          limit: this.getSignaturesLimit,
        }
      );
      for (const { signature } of signatures) {
        const res = await this.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!res || !res.blockTime) {
          throw new Error(`solana: failed to fetch tx for signature ${signature}`);
        }

        const message = res.transaction.message;
        const accountKeys = isLegacyMessage(message)
          ? message.accountKeys
          : message.staticAccountKeys;
        const programIdIndex = accountKeys.findIndex((i) => i.toBase58() === WORMHOLE_PROGRAM_ID);
        const instructions = message.compiledInstructions;
        const innerInstructions =
          res.meta?.innerInstructions?.flatMap((i) =>
            i.instructions.map(normalizeCompileInstruction)
          ) || [];
        const whInstructions = innerInstructions
          .concat(instructions)
          .filter((i) => i.programIdIndex === programIdIndex);
        for (const instruction of whInstructions) {
          // skip if not postMessage instruction
          const instructionId = instruction.data;
          if (instructionId[0] !== 0x01 && instructionId[0] !== 0x08) continue;

          const accountId = accountKeys[instruction.accountKeyIndexes[1]];
          const {
            message: { emitterAddress, sequence },
          } = await getPostedMessage(this.connection, accountId.toBase58(), COMMITMENT);
          const blockKey = makeBlockKey(
            res.slot.toString(),
            new Date(res.blockTime * 1000).toISOString()
          );
          const vaaKey = makeVaaKey(
            signature,
            this.chain,
            emitterAddress.toString('hex'),
            sequence.toString()
          );
          vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
        }
      }

      numSignatures = signatures.length;
      currSignature = signatures.at(-1)?.signature;
    }

    // add last block for storeVaasByBlock
    const lastBlockKey = makeBlockKey(
      toSlot.toString(),
      new Date(toBlock.blockTime * 1000).toISOString()
    );
    return Object.assign({ [lastBlockKey]: [] }, vaasByBlock);
  }
}
