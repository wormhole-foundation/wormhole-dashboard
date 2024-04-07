import { ChainId, Network as SdkNetwork, chainToChainId, rpc } from '@wormhole-foundation/sdk-base';
import { Network } from '../contexts/NetworkContext';
import { SUPPORTED_EVM_CHAINS, NTT_MANAGER_CONTRACT } from './consts';
import {
  getCurrentInboundCapacity,
  getCurrentOutboundCapacity,
  getTokenDecimals,
} from './evmNttHelpers';

export type RateLimit = {
  srcChain: ChainId;
  destChain?: ChainId;
  amount: bigint;
  totalInboundCapacity?: bigint;
  inboundCapacity?: RateLimit[];
};

export async function getRateLimits(network: Network): Promise<RateLimit[]> {
  const records: RateLimit[] = [];

  const promises = SUPPORTED_EVM_CHAINS[network.name].map(async (chain) => {
    const rpcAddress = rpc.rpcAddress(network.name as SdkNetwork, chain);
    const contractAddress = NTT_MANAGER_CONTRACT[network.name as SdkNetwork][chain]!;
    const tokenDecimals = await getTokenDecimals(rpcAddress, contractAddress);

    const inboundCapacity: RateLimit[] = [];
    // TODO: include Solana in the loop
    let totalInboundCapacity = BigInt(0);
    for (const supportedChain of SUPPORTED_EVM_CHAINS[network.name]) {
      if (chain === supportedChain) continue;
      const inboundCapacityAmount = await getCurrentInboundCapacity(
        rpcAddress,
        contractAddress,
        chainToChainId(supportedChain)
      );
      const normalizedInboundCapacityAmount = inboundCapacityAmount / BigInt(10 ** tokenDecimals);
      inboundCapacity.push({
        srcChain: chainToChainId(chain),
        destChain: chainToChainId(supportedChain),
        amount: normalizedInboundCapacityAmount,
      });

      totalInboundCapacity += normalizedInboundCapacityAmount;
    }

    const outboundCapacityAmount = await getCurrentOutboundCapacity(rpcAddress, contractAddress);
    records.push({
      srcChain: chainToChainId(chain),
      amount: outboundCapacityAmount / BigInt(10 ** tokenDecimals),
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

  // To make sure the records are sorted by srcChain
  records.sort((a, b) => a.srcChain - b.srcChain);

  return records;
}
