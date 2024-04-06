import { EvmNtt } from '@wormhole-foundation/sdk-evm-ntt';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import { Connection } from '@solana/web3.js';
import { SolanaNtt } from '@wormhole-foundation/sdk-solana-ntt';
import { JsonRpcProvider } from 'ethers';
import {
  Chain,
  ChainId,
  Network as SdkNetwork,
  chainToChainId,
  rpc,
} from '@wormhole-foundation/sdk-base';

import { Network } from '../contexts/NetworkContext';
import {
  SUPPORTED_EVM_CHAINS,
  NTT_TOKENS,
  NTT_MANAGER_CONTRACT,
  NTT_TRANSCEIVER_CONTRACT,
} from '@wormhole-foundation/wormhole-monitor-common';

export type RateLimit = {
  srcChain: ChainId;
  destChain?: ChainId;
  amount: bigint;
  totalInboundCapacity?: bigint;
  inboundCapacity?: RateLimit[];
};

export async function getRateLimits(network: Network): Promise<RateLimit[]> {
  const evmNtts = getNtts(network);

  const records: RateLimit[] = [];

  const promises = Array.from(evmNtts.entries()).map(async ([chain, ntt]) => {
    const inboundCapacity: RateLimit[] = [];
    // TODO: include Solana in the loop
    let totalInboundCapacity = BigInt(0);
    for (const supportedChain of SUPPORTED_EVM_CHAINS[network.name]) {
      if (chain === supportedChain) continue;
      let inboundCapacityAmount =
        (await ntt.getCurrentInboundCapacity(supportedChain)) / BigInt(10 ** 18);
      inboundCapacity.push({
        srcChain: chainToChainId(chain),
        destChain: chainToChainId(supportedChain),
        amount: inboundCapacityAmount,
      });

      totalInboundCapacity += inboundCapacityAmount;
    }

    records.push({
      srcChain: chainToChainId(chain),
      amount: (await ntt.getCurrentOutboundCapacity()) / BigInt(10 ** 18),
      inboundCapacity,
      totalInboundCapacity,
    });
  });

  // TODO: Uncomment after Ben replies
  //   const solNtt = getSolNtt(network)!;

  //   {
  //     const inboundCapacity: { [key in Chain]?: bigint } = {};
  //     for (const supportedChain of supportedEvmChains[network.name]) {
  //       if ('Solana' === supportedChain) continue;
  //       inboundCapacity[supportedChain] = await solNtt.getCurrentInboundCapacity(supportedChain);
  //     }

  //     supportedEvmChains[network.name].forEach(async (chain) => {
  //       records.push({
  //         chain: 'Solana',
  //         outboundCapacity: await solNtt.getCurrentOutboundCapacity(),
  //         inboundCapacity,
  //       });
  //     });
  //   }
  await Promise.all(promises);

  return records;
}

function getNtts(network: Network): Map<Chain, EvmNtt<SdkNetwork, EvmChains>> {
  return SUPPORTED_EVM_CHAINS[network.name].reduce((map, chain) => {
    try {
      const rpcAddress = rpc.rpcAddress(network.name as SdkNetwork, chain);
      map.set(
        chain,
        new EvmNtt(
          network.name as SdkNetwork,
          chain as EvmChains,
          new JsonRpcProvider(rpcAddress),
          {
            ntt: {
              token: NTT_TOKENS[network.name as SdkNetwork][chain]!,
              manager: NTT_MANAGER_CONTRACT[network.name as SdkNetwork][chain]!,
              transceiver: {
                wormhole: NTT_TRANSCEIVER_CONTRACT[network.name as SdkNetwork][chain]!,
              },
            },
          }
        )
      );
    } catch (error) {
      console.error(`Error initializing NTT for ${chain} on ${network.name}:`, error);
    }

    return map;
  }, new Map<Chain, EvmNtt<SdkNetwork, EvmChains>>());
}

function getSolNtt(network: Network): SolanaNtt<SdkNetwork, 'Solana'> | undefined {
  const rpcAddress = rpc.rpcAddress(network.name as SdkNetwork, 'Solana');

  try {
    return new SolanaNtt(network.name as SdkNetwork, 'Solana', new Connection(rpcAddress), {
      // TODO: corebridge address should not be needed
      coreBridge: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
      ntt: {
        token: NTT_TOKENS[network.name as SdkNetwork]['Solana']!,
        manager: NTT_MANAGER_CONTRACT[network.name as SdkNetwork]['Solana']!,
        transceiver: {
          wormhole: NTT_TRANSCEIVER_CONTRACT[network.name as SdkNetwork]['Solana']!,
        },
      },
    });
  } catch (error) {
    console.error(`Error initializing Solana NTT on ${network.name}:`, error);
  }
}
