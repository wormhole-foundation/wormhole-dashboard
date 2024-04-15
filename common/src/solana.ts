import {
  CompiledInstruction,
  Message,
  MessageCompiledInstruction,
  MessageV0,
} from '@solana/web3.js'; // NOTE: types only for bundling size
import { decode } from 'bs58';
import axios from 'axios';

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

export const getSolanaTokenDecimals = async (rpc: string, mintAddress: string): Promise<number> => {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAccountInfo',
    params: [
      mintAddress,
      {
        encoding: 'jsonParsed',
      },
    ],
  };

  try {
    const response = await axios.post(rpc, payload);
    const result = response.data.result;
    if (result?.value?.data?.parsed?.info?.decimals !== undefined) {
      return result.value.data.parsed.info.decimals;
    } else {
      throw new Error('Failed to get mint decimals: decimals not found in response');
    }
  } catch (e) {
    throw new Error(`Failed to get mint decimals: ${e}`);
  }
};
