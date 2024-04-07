import {
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  assertEnvironmentVariable,
  derivePda,
  getEvmTokenDecimals,
  getEvmTotalSupply,
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

async function getEvmNormalizedTotalSupply(
  network: Network,
  token: string,
  chain: Chain
): Promise<number> {
  const tokenDecimals = await getEvmTokenDecimals(
    rpc.rpcAddress(network, chain),
    NTT_MANAGER_CONTRACT[network][token][chain]!
  );
  const tokenSupply = await getEvmTotalSupply(
    rpc.rpcAddress(network, chain),
    NTT_TOKENS[network][token][chain]!
  );

  return tokenSupply / 10 ** tokenDecimals;
}

async function fetchTotalSupplyAndLocked(network: Network): Promise<NTTTotalSupplyAndLockedData[]> {
  const tokens = NTT_MANAGER_CONTRACT[network];
  const totalSupplyVsLocked: NTTTotalSupplyAndLockedData[] = [];
  for (const token in tokens) {
    if (!NTT_MANAGER_CONTRACT[network][token].Solana) continue;

    const programId = new PublicKey(NTT_MANAGER_CONTRACT[network][token].Solana!);
    const pda = derivePda('config', programId);
    const custody = await getCustody(rpc.rpcAddress(network, 'Solana'), pda.toBase58());
    const locked = await getCustodyAmount(rpc.rpcAddress(network, 'Solana'), custody);

    const evmTotalSupply: NTTTotalSupplyAndLockedData[] = [];
    let totalSupply = 0;
    for (const [supportedChain] of Object.entries(NTT_TOKENS[network][token])) {
      if (supportedChain === 'Solana') continue;
      const tokenSupplyNormalized = await getEvmNormalizedTotalSupply(
        network,
        token,
        supportedChain as Chain
      );

      evmTotalSupply.push({
        tokenName: token,
        chain: chainToChainId(supportedChain as Chain),
        totalSupply: tokenSupplyNormalized,
      });

      totalSupply += tokenSupplyNormalized;
    }

    totalSupplyVsLocked.push({
      chain: chainToChainId('Solana'),
      tokenName: token,
      amountLocked: locked,
      totalSupply,
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
