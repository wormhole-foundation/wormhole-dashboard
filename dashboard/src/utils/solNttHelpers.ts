import axios from 'axios';
import { PublicKeyInitData, PublicKey } from '@solana/web3.js';
import { ChainId, encoding } from '@wormhole-foundation/sdk-base';

export async function getTokenDecimals(rpc: string, mintAddress: string): Promise<number> {
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
}

export async function getCurrentOutboundCapacity(
  rpcUrl: string,
  programAddress: string
): Promise<bigint> {
  const outboxRateLimitAddress = await derivePda(
    'outbox_rate_limit', // Replace with the actual seed used
    programAddress
  );

  const response = await axios.post(rpcUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAccountInfo',
    params: [
      outboxRateLimitAddress,
      {
        encoding: 'base64',
      },
    ],
  });

  if (response.data.error) {
    throw new Error(`Error fetching outbox rate limit account: ${response.data.error.message}`);
  }

  const accountInfo = response.data.result;
  if (!accountInfo || !accountInfo.value || !accountInfo.value.data || !accountInfo.value.data[0]) {
    throw new Error('Outbox rate limit account not found or missing data');
  }

  const data = new Uint8Array(
    atob(accountInfo.value.data[0])
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const capacity = new DataView(data.buffer).getBigUint64(8, true); // Read capacity_at_last_tx field

  return capacity;
}

const chainToBytes = (chain: ChainId) => encoding.bignum.toBytes(chain, 2);

export async function getCurrentInboundCapacity(
  rpcUrl: string,
  programAddress: string,
  fromChain: ChainId
): Promise<bigint> {
  const inboxRateLimitAddress = await derivePda(
    ['inbox_rate_limit', chainToBytes(fromChain)],
    programAddress
  );

  const response = await axios.post(rpcUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAccountInfo',
    params: [
      inboxRateLimitAddress,
      {
        encoding: 'base64',
      },
    ],
  });

  if (response.data.error) {
    throw new Error(`Error fetching inbox rate limit account: ${response.data.error.message}`);
  }

  const accountInfo = response.data.result;
  if (!accountInfo || !accountInfo.value || !accountInfo.value.data || !accountInfo.value.data[0]) {
    throw new Error('Inbox rate limit account not found or missing data');
  }

  const data = new Uint8Array(
    atob(accountInfo.value.data[0])
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const capacity = new DataView(data.buffer).getBigUint64(8, true); // Read capacity_at_last_tx field

  return capacity;
}

type Seed = Uint8Array | string;
export function derivePda(seeds: Seed | readonly Seed[], programId: PublicKeyInitData) {
  const toBytes = (s: string | Uint8Array) =>
    typeof s === 'string' ? encoding.bytes.encode(s) : s;
  return PublicKey.findProgramAddressSync(
    Array.isArray(seeds) ? seeds.map(toBytes) : [toBytes(seeds as Seed)],
    new PublicKey(programId)
  )[0];
}
