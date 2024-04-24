import {
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  assertEnvironmentVariable,
  derivePda,
  getEvmTokenDecimals,
  getEvmTotalSupply,
  normalizeToDecimals,
} from '@wormhole-foundation/wormhole-monitor-common';
import { PublicKey } from '@solana/web3.js';
import {
  getCustody,
  getCustodyAmount,
  NTTTotalSupplyAndLockedData,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Network, rpc, Chain, chainToChainId } from '@wormhole-foundation/sdk-base';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
let bucketName: string = 'wormhole-ntt-cache';
if (assertEnvironmentVariable('NETWORK') === 'Testnet') {
  bucketName = 'wormhole-ntt-cache-testnet';
}

const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'ntt-total-supply-and-locked.json';
const cloudStorageCache = cacheBucket.file(cacheFileName);

async function fetchTotalSupplyAndLocked(network: Network): Promise<NTTTotalSupplyAndLockedData[]> {
  const tokens = NTT_MANAGER_CONTRACT[network];
  const totalSupplyVsLocked: NTTTotalSupplyAndLockedData[] = [];
  for (const token in tokens) {
    if (!NTT_MANAGER_CONTRACT[network][token].Solana) continue;

    const programId = new PublicKey(NTT_MANAGER_CONTRACT[network][token].Solana!);
    const pda = derivePda('config', programId);
    const custody = await getCustody(rpc.rpcAddress(network, 'Solana'), pda.toBase58());
    const custodyAmount = await getCustodyAmount(rpc.rpcAddress(network, 'Solana'), custody);

    const evmTotalSupply: NTTTotalSupplyAndLockedData[] = [];
    let cumulativeEvmSupply = 0n;
    for (const [supportedChain] of Object.entries(NTT_TOKENS[network][token])) {
      if (supportedChain === 'Solana') continue;
      const tokenSupply = await getEvmTotalSupply(
        rpc.rpcAddress(network, supportedChain as Chain),
        NTT_TOKENS[network][token][supportedChain as Chain]!
      );

      const tokenDecimals = await getEvmTokenDecimals(
        rpc.rpcAddress(network, supportedChain as Chain),
        NTT_MANAGER_CONTRACT[network][token][supportedChain as Chain]!
      );

      evmTotalSupply.push({
        tokenName: token,
        chain: chainToChainId(supportedChain as Chain),
        totalSupply: {
          amount: tokenSupply.toString(),
          decimals: tokenDecimals,
        },
      });

      // Normalize to 18 decimals so prevent potential different decimals from affecting the total supply
      cumulativeEvmSupply += normalizeToDecimals(
        {
          amount: tokenSupply.toString(),
          decimals: tokenDecimals,
        },
        18
      );
    }

    totalSupplyVsLocked.push({
      chain: chainToChainId('Solana'),
      tokenName: token,
      amountLocked: custodyAmount,
      totalSupply: {
        amount: cumulativeEvmSupply.toString(),
        decimals: 18,
      },
      evmTotalSupply,
    });
  }

  return totalSupplyVsLocked;
}

export async function computeTotalSupplyAndLocked(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }

  try {
    const network = assertEnvironmentVariable('NETWORK') as Network;
    const totalSupplyAndLocked = await fetchTotalSupplyAndLocked(network);
    await cloudStorageCache.save(JSON.stringify(totalSupplyAndLocked));
    res.status(200).send('Total supply and locked saved');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
