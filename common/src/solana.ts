import {
  CompiledInstruction,
  Message,
  MessageCompiledInstruction,
  MessageV0,
  VersionedBlockResponse,
  SolanaJSONRPCError,
} from '@solana/web3.js';
import { decode } from 'bs58';
import { Connection } from '@solana/web3.js';
import { RPCS_BY_CHAIN } from '@certusone/wormhole-sdk/lib/cjs/relayer';
import { CONTRACTS } from '@certusone/wormhole-sdk';

export const isLegacyMessage = (message: Message | MessageV0): message is Message => {
  return message.version === 'legacy';
};

export const normalizeCompileInstruction = (
  instruction: CompiledInstruction | MessageCompiledInstruction
): MessageCompiledInstruction => {
  if ('accounts' in instruction) {
    return {
      accountKeyIndexes: instruction.accounts,
      data: decode(instruction.data),
      programIdIndex: instruction.programIdIndex,
    };
  } else {
    return instruction;
  }
};

export async function convertSolanaTxToAccts(txHash: string): Promise<string[]> {
  const POST_MESSAGE_IX_ID = 0x01;
  let accounts: string[] = [];
  const connection = new Connection(RPCS_BY_CHAIN.MAINNET.solana!, 'finalized');
  const txs = await connection.getTransactions([txHash], {
    maxSupportedTransactionVersion: 0,
  });
  for (const tx of txs) {
    if (!tx) {
      continue;
    }
    const message = tx.transaction.message;
    const accountKeys = isLegacyMessage(message) ? message.accountKeys : message.staticAccountKeys;
    const programIdIndex = accountKeys.findIndex(
      (i) => i.toBase58() === CONTRACTS.MAINNET.solana.core
    );
    const instructions = message.compiledInstructions;
    const innerInstructions =
      tx.meta?.innerInstructions?.flatMap((i) => i.instructions.map(normalizeCompileInstruction)) ||
      [];
    const whInstructions = innerInstructions
      .concat(instructions)
      .filter((i) => i.programIdIndex === programIdIndex);
    for (const instruction of whInstructions) {
      // skip if not postMessage instruction
      const instructionId = instruction.data;
      if (instructionId[0] !== POST_MESSAGE_IX_ID) continue;

      accounts.push(accountKeys[instruction.accountKeyIndexes[1]].toBase58());
    }
  }
  return accounts;
}

export const findNextValidBlock = async (
  connection: Connection,
  slot: number,
  next: number,
  retries: number
): Promise<VersionedBlockResponse> => {
  // identify block range by fetching signatures of the first and last transactions
  // getSignaturesForAddress walks backwards so fromSignature occurs after toSignature
  if (retries === 0) throw new Error(`No block found after exhausting retries`);

  let block: VersionedBlockResponse | null = null;
  try {
    block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });
  } catch (e) {
    if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
      // failed to get confirmed block: slot was skipped or missing in long-term storage
      return findNextValidBlock(connection, slot + next, next, retries - 1);
    } else {
      throw e;
    }
  }

  if (!block || !block.blockTime || block.transactions.length === 0) {
    return findNextValidBlock(connection, slot + next, next, retries - 1);
  }

  return block;
};

export const findFromSignatureAndToSignature = async (
  connection: Connection,
  fromSlot: number,
  toSlot: number,
  retries = 5
) => {
  let toBlock: VersionedBlockResponse;
  let fromBlock: VersionedBlockResponse;

  try {
    toBlock = await findNextValidBlock(connection, toSlot + 1, -1, retries);
    fromBlock = await findNextValidBlock(connection, fromSlot - 1, 1, retries);
  } catch (e) {
    throw new Error('solana: invalid block range: ' + (e as Error).message);
  }

  const fromSignature = toBlock.transactions[0].transaction.signatures[0];
  const toSignature =
    fromBlock.transactions[fromBlock.transactions.length - 1].transaction.signatures[0];

  return { fromSignature, toSignature, toBlock };
};
