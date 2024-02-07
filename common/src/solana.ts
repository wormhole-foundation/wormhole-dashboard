import {
  CompiledInstruction,
  Message,
  MessageCompiledInstruction,
  MessageV0,
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
