import {
  Chain,
  ChainId,
  Network as SdkNetwork,
  chainToChainId,
  rpc,
} from '@wormhole-foundation/sdk-base';
import { Network } from '../contexts/NetworkContext';
import {
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  NTT_SUPPORTED_CHAINS,
} from '@wormhole-foundation/wormhole-monitor-common';

import {
  getCurrentInboundCapacity,
  getCurrentOutboundCapacity,
  getTokenDecimals,
} from './evmNttHelpers';

import {
  getTokenDecimals as getSolTokenDecimals,
  getCurrentOutboundCapacity as getSolOutboundCapacity,
  getCurrentInboundCapacity as getSolInboundCapacity,
} from './solNttHelpers';

export type RateLimit = {
  tokenName: string;
  srcChain?: ChainId;
  destChain?: ChainId;
  amount?: bigint;
  totalInboundCapacity?: bigint;
  inboundCapacity?: RateLimit[];
};

export async function getRateLimits(network: Network): Promise<RateLimit[]> {
  const rateLimitsByToken: RateLimit[] = [];
  const tokenContractAddresses = NTT_MANAGER_CONTRACT[network.name as SdkNetwork];

  for (const [tokenName, chainContractAddresses] of Object.entries(tokenContractAddresses)) {
    const rateLimitsByChain: RateLimit[] = [];
    const promises = NTT_SUPPORTED_CHAINS(network.name as SdkNetwork, tokenName).map(
      async (chain) => {
        try {
          const contractAddress = chainContractAddresses[chain];
          if (contractAddress) {
            let rateLimit: RateLimit | null = null;
            if (chain === 'Solana') {
              rateLimit = await getSolanaRateLimits(network, tokenName);
            } else {
              rateLimit = await getEvmRateLimits(network, chain, tokenName, contractAddress);
            }

            if (rateLimit) rateLimitsByChain.push(rateLimit);
          }
        } catch (e) {
          console.error(e);
        }
      }
    );

    await Promise.all(promises);

    rateLimitsByChain.sort((a, b) => a.srcChain! - b.srcChain!);

    const rateLimit = {
      tokenName,
      inboundCapacity: rateLimitsByChain,
    };

    rateLimitsByToken.push(rateLimit);
  }

  return rateLimitsByToken;
}

async function getEvmRateLimits(
  network: Network,
  chain: Chain,
  tokenName: string,
  contractAddress: string
): Promise<RateLimit> {
  const rpcAddress = rpc.rpcAddress(network.name as SdkNetwork, chain);

  const tokenDecimals = await getTokenDecimals(rpcAddress, contractAddress);
  const inboundCapacity: RateLimit[] = [];
  let totalInboundCapacity = BigInt(0);

  for (const supportedChain of NTT_SUPPORTED_CHAINS(network.name as SdkNetwork, tokenName)) {
    if (chain === supportedChain) continue;
    const inboundCapacityAmount = await getCurrentInboundCapacity(
      rpcAddress,
      contractAddress,
      chainToChainId(supportedChain)
    );
    const normalizedInboundCapacityAmount = inboundCapacityAmount / BigInt(10 ** tokenDecimals);
    inboundCapacity.push({
      tokenName,
      srcChain: chainToChainId(chain),
      destChain: chainToChainId(supportedChain),
      amount: normalizedInboundCapacityAmount,
    });

    totalInboundCapacity += normalizedInboundCapacityAmount;
  }

  const outboundCapacityAmount = await getCurrentOutboundCapacity(rpcAddress, contractAddress);
  inboundCapacity.sort((a, b) => a.destChain! - b.destChain!);
  return {
    tokenName,
    srcChain: chainToChainId(chain),
    amount: outboundCapacityAmount / BigInt(10 ** tokenDecimals),
    inboundCapacity,
    totalInboundCapacity,
  };
}

async function getSolanaRateLimits(network: Network, tokenName: string): Promise<RateLimit | null> {
  try {
    const solRpcAddress = rpc.rpcAddress(network.name as SdkNetwork, 'Solana');
    const solTokenAddress = NTT_TOKENS[network.name as SdkNetwork][tokenName]['Solana']!;
    const solManagerAddress =
      NTT_MANAGER_CONTRACT[network.name as SdkNetwork][tokenName]['Solana']!;

    const solOutboundCapacityAmount = await getSolOutboundCapacity(
      solRpcAddress,
      solManagerAddress!
    );

    const solTokenDecimals = await getSolTokenDecimals(solRpcAddress, solTokenAddress);
    console.log('tokenDecimals', solTokenDecimals);

    const inboundCapacity: RateLimit[] = [];
    let totalInboundCapacity = BigInt(0);

    for (const supportedChain of NTT_SUPPORTED_CHAINS(network.name as SdkNetwork, tokenName)) {
      const inboundCapacityAmount = await getSolInboundCapacity(
        solRpcAddress,
        solManagerAddress,
        chainToChainId(supportedChain)
      );
      const normalizedInboundCapacityAmount =
        inboundCapacityAmount / BigInt(10 ** solTokenDecimals);
      inboundCapacity.push({
        tokenName,
        srcChain: chainToChainId('Solana'),
        destChain: chainToChainId(supportedChain),
        amount: normalizedInboundCapacityAmount,
      });

      totalInboundCapacity += normalizedInboundCapacityAmount;
    }

    return {
      tokenName,
      srcChain: chainToChainId('Solana'),
      amount: solOutboundCapacityAmount / BigInt(10 ** solTokenDecimals),
      inboundCapacity,
      totalInboundCapacity,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
