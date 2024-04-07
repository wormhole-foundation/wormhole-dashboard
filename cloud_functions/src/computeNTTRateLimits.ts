import {
  assertEnvironmentVariable,
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  NTT_TRANSCEIVER_CONTRACT,
  NTT_SUPPORTED_CHAINS,
  getEvmTokenDecimals,
  getSolanaTokenDecimals,
  NTTRateLimit,
} from '@wormhole-foundation/wormhole-monitor-common';
import { EvmPlatform, EvmChains } from '@wormhole-foundation/sdk-evm';
import { SolanaPlatform } from '@wormhole-foundation/sdk-solana';
import { EvmNtt } from '@wormhole-foundation/sdk-evm-ntt';
import { SolanaNtt } from '@wormhole-foundation/sdk-solana-ntt';
import { Network, Chain, contracts, rpc, chainToChainId } from '@wormhole-foundation/sdk-base';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
let bucketName: string = 'wormhole-ntt-cache';
if (assertEnvironmentVariable('NETWORK') === 'Testnet') {
  bucketName = 'wormhole-ntt-cache-testnet';
}

const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'ntt-rate-limits-cache.json';
const cloudStorageCache = cacheBucket.file(cacheFileName);

async function computeNTTRateLimits_(
  network: Network,
  token: string,
  chain: Chain
): Promise<NTTRateLimit> {
  let ntt: EvmNtt<Network, EvmChains> | SolanaNtt<Network, 'Solana'>;
  let tokenDecimals: number;
  const rpcEndpoint = rpc.rpcAddress(network, chain as Chain);
  const tokenAddress = NTT_TOKENS[network][token][chain]!;
  const managerContract = NTT_MANAGER_CONTRACT[network][token][chain]!;
  const transceiverContract = NTT_TRANSCEIVER_CONTRACT[network][token][chain]!;

  if (chain === 'Solana') {
    const platform = new SolanaPlatform(network);
    ntt = new SolanaNtt(network, chain, platform.getRpc(chain), {
      coreBridge: contracts.coreBridge(network, chain),
      ntt: {
        token: tokenAddress,
        manager: managerContract,
        transceiver: {
          wormhole: transceiverContract,
        },
      },
    });
    tokenDecimals = await getSolanaTokenDecimals(rpcEndpoint, tokenAddress);
  } else {
    const evmChain = chain as EvmChains;
    const platform = new EvmPlatform(network);
    ntt = new EvmNtt(network, evmChain, platform.getRpc(evmChain), {
      ntt: {
        token: tokenAddress,
        manager: managerContract,
        transceiver: {
          wormhole: transceiverContract,
        },
      },
    });
    tokenDecimals = await getEvmTokenDecimals(rpcEndpoint, managerContract);
  }

  const outboundCapacity = await ntt.getCurrentOutboundCapacity();
  const normalizedOutboundCapacity = outboundCapacity / BigInt(10 ** tokenDecimals);

  const inboundChains = NTT_SUPPORTED_CHAINS(network, token).filter(
    (inboundChain) => inboundChain !== chain
  );

  let totalInboundCapacity = BigInt(0);
  const inboundRateLimits = await Promise.all(
    inboundChains.map(async (inboundChain): Promise<NTTRateLimit> => {
      const inboundCapacity = await ntt.getCurrentInboundCapacity(inboundChain);
      const normalizedInboundCapacity = inboundCapacity / BigInt(10 ** tokenDecimals);
      totalInboundCapacity += normalizedInboundCapacity;

      return {
        tokenName: token,
        srcChain: chainToChainId(inboundChain),
        destChain: chainToChainId(chain),
        amount: normalizedInboundCapacity.toString(),
      };
    })
  );

  return {
    tokenName: token,
    srcChain: chainToChainId(chain),
    amount: normalizedOutboundCapacity.toString(),
    inboundCapacity: inboundRateLimits,
    totalInboundCapacity: totalInboundCapacity.toString(),
  };
}

export async function computeNTTRateLimits(req: any, res: any) {
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
    const managerContracts = NTT_MANAGER_CONTRACT[network];

    const rateLimits = await Promise.all(
      Object.entries(managerContracts).map(async ([token, manager]) => {
        const inboundCapacityPromises = Object.entries(manager)
          .map(([chain, contract]) =>
            contract ? computeNTTRateLimits_(network, token, chain as Chain) : null
          )
          .filter(Boolean);

        const inboundCapacity = await Promise.all(inboundCapacityPromises);

        return {
          tokenName: token,
          inboundCapacity: inboundCapacity,
        };
      })
    );
    await cloudStorageCache.save(JSON.stringify(rateLimits));
    res.status(200).send('Rate limits saved');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
