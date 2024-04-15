import {
  assertEnvironmentVariable,
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  NTT_TRANSCEIVER_CONTRACT,
  NTT_SUPPORTED_CHAINS,
  getEvmTokenDecimals,
  getSolanaTokenDecimals,
} from '@wormhole-foundation/wormhole-monitor-common';
import { EvmPlatform, EvmChains } from '@wormhole-foundation/sdk-evm';
import { SolanaPlatform } from '@wormhole-foundation/sdk-solana';
import { EvmNtt } from '@wormhole-foundation/sdk-evm-ntt';
import { SolanaNtt } from '@wormhole-foundation/sdk-solana-ntt';
import { Network, Chain, contracts, rpc } from '@wormhole-foundation/sdk-base';
import { Gauge, register } from 'prom-client';

const outboundCapacityGauge = new Gauge({
  name: 'ntt_outbound_capacity',
  help: 'NTT outbound capacity for token on chain',
  labelNames: ['token', 'chain', 'network', 'product'],
});

const inboundCapacityGauge = new Gauge({
  name: 'ntt_inbound_capacity',
  help: 'NTT inbound capacity for token on chain from inbound_chain',
  labelNames: ['token', 'chain', 'inbound_chain', 'network', 'product'],
});

const PRODUCT = 'cloud_functions_ntt';

async function setCapacityGauge(
  gauge: Gauge,
  labels: Record<string, string | number>,
  capacity: bigint
) {
  gauge.set(labels, Number(capacity));
}

async function getRateLimits(network: Network, token: string, chain: Chain) {
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

  await setCapacityGauge(
    outboundCapacityGauge,
    { token, chain, network, product: PRODUCT },
    normalizedOutboundCapacity
  );

  const inboundChains = NTT_SUPPORTED_CHAINS(network, token).filter(
    (inboundChain) => inboundChain !== chain
  );
  await Promise.all(
    inboundChains.map(async (inboundChain) => {
      const inboundCapacity = await ntt.getCurrentInboundCapacity(inboundChain);
      const normalizedInboundCapacity = inboundCapacity / BigInt(10 ** tokenDecimals);
      await setCapacityGauge(
        inboundCapacityGauge,
        { token, chain, inbound_chain: inboundChain, network, product: PRODUCT },
        normalizedInboundCapacity
      );
    })
  );
}

export async function getNTTRateLimits(req: any, res: any) {
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

    const rateLimitPromises = Object.entries(managerContracts).flatMap(([token, manager]) =>
      Object.entries(manager)
        .map(([chain, contract]) =>
          contract ? getRateLimits(network, token, chain as Chain) : null
        )
        .filter(Boolean)
    );

    await Promise.all(rateLimitPromises);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
