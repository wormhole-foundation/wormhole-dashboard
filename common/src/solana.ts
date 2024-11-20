import {
  CompiledInstruction,
  Message,
  MessageCompiledInstruction,
  MessageV0,
  PublicKeyInitData,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import axios from 'axios';
import { decode } from 'bs58';
import { encoding } from '@wormhole-foundation/sdk-base';
import { TokenAmount } from './types';
import { retry } from './utils';

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
    const response = await retry(() => axios.post(rpc, payload));
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

export async function getCustodyAmount(
  rpcUrl: string,
  programAddress: string
): Promise<TokenAmount> {
  const accountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [programAddress], 'jsonParsed');
  if (!accountInfo.value?.data?.parsed?.info?.tokenAmount?.uiAmount) {
    throw new Error('Custody amount not found or missing data');
  }
  return {
    amount: accountInfo.value.data.parsed.info.tokenAmount.amount,
    decimals: accountInfo.value.data.parsed.info.tokenAmount.decimals,
  };
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

  const response = await retry(() => axios.post(rpcUrl, payload));
  if (response.data.error) {
    throw new Error(`Error fetching ${method} account: ${response.data.error.message}`);
  }
  return response.data.result;
}

// Helper function to decode base64 data
export function decodeBase64Data(encodedData: string) {
  return new Uint8Array(Buffer.from(encodedData, 'base64'));
}

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';
export function parseWormholeSequenceFromLogs(logs: string[]): number | null {
  for (const log of logs) {
    if (log.startsWith(SOLANA_SEQ_LOG)) {
      return parseInt(log.replace(SOLANA_SEQ_LOG, ''), 10);
    }
  }
  return null;
}

export function blockTimeToDate(blockTime: number) {
  return new Date(blockTime * 1000);
}

/**
 * Calculates the change in token balance for a specified token within an associated token account
 * owned by a given owner. If the tokenBalance is not found, an amount of 0n is to be assumed
 *
 * @param transaction - The transaction object, which contains metadata and details about pre and post
 * transaction states, including token balances.
 * @param owner - The public key of the owner of the associated token account whose token balance
 * change is to be calculated.
 * @param mint - The mint address of the specific token for which the balance change is to be calculated.
 *
 * @returns The difference between the token balance after the transaction (`postTokenBalance`) and
 * the token balance before the transaction (`preTokenBalance`). This value is returned as a `BigInt`
 * and represents the change in token balance for the specified owner and token.
 */
export function getTokenBalanceChange(
  transaction: VersionedTransactionResponse,
  owner: string,
  mint: string,
) {
  const preTokenBalances = transaction.meta?.preTokenBalances || [];
  const postTokenBalances = transaction.meta?.postTokenBalances || [];

  console.log(`Owner: ${owner}, Mint: ${mint}`);

  const preTokenBalance = preTokenBalances.find((tb) => tb.mint === mint && tb.owner === owner) || {
    uiTokenAmount: {
      amount: 0n,
    },
  };
  console.log(`Pre-transaction token balance: ${preTokenBalance.uiTokenAmount.amount}`);

  const postTokenBalance = postTokenBalances.find(
    (tb) => tb.mint === mint && tb.owner === owner
  ) || {
    uiTokenAmount: {
      amount: 0n,
    },
  };
  console.log(`Post-transaction token balance: ${postTokenBalance.uiTokenAmount.amount}`);

  const change =
    BigInt(postTokenBalance.uiTokenAmount.amount) - BigInt(preTokenBalance.uiTokenAmount.amount);

  return change;
}
