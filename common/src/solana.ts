import {
  CompiledInstruction,
  Message,
  MessageCompiledInstruction,
  MessageV0,
  PublicKeyInitData,
  PublicKey,
} from '@solana/web3.js'; // NOTE: types only for bundling size
import { decode } from 'bs58';
import axios from 'axios';
import { encoding } from '@wormhole-foundation/sdk-base';

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

// copied from https://github.com/wormhole-foundation/example-native-token-transfers/blob/main/solana/ts/sdk/utils.ts#L55-L56
type Seed = Uint8Array | string;
export function derivePda(seeds: Seed | readonly Seed[], programId: PublicKeyInitData) {
  const toBytes = (s: string | Uint8Array) =>
    typeof s === 'string' ? encoding.bytes.encode(s) : s;
  return PublicKey.findProgramAddressSync(
    Array.isArray(seeds) ? seeds.map(toBytes) : [toBytes(seeds as Seed)],
    new PublicKey(programId)
  )[0];
}

export async function getCustody(rpcUrl: string, programAddress: string): Promise<string> {
  const accountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [programAddress], 'jsonParsed');
  const data = decodeBase64Data(accountInfo.value.data[0]);
  const pubkey = new PublicKey(data.slice(128, 128 + 32));
  return pubkey.toString();
}

export async function getCustodyAmount(rpcUrl: string, programAddress: string): Promise<number> {
  const accountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [programAddress], 'jsonParsed');
  if (!accountInfo.value?.data?.parsed?.info?.tokenAmount?.uiAmount) {
    throw new Error('Custody amount not found or missing data');
  }
  return Number(accountInfo.value.data.parsed.info.tokenAmount.uiAmount);
}

// Helper function to make JSON-RPC requests
export async function makeRpcCall(
  rpcUrl: string,
  method: string,
  params: any[],
  encodingType: string
) {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: method,
    params: [
      ...params,
      {
        encoding: encodingType,
      },
    ],
  };

  const response = await axios.post(rpcUrl, payload);
  if (response.data.error) {
    throw new Error(`Error fetching ${method} account: ${response.data.error.message}`);
  }
  return response.data.result;
}

// Helper function to decode base64 data
export function decodeBase64Data(encodedData: string) {
  return new Uint8Array(Buffer.from(encodedData, 'base64'));
}
