import {
  assertEnvironmentVariable,
  NTT_MANAGER_CONTRACT,
  NTT_TOKENS,
  NTT_TRANSCEIVER_CONTRACT,
  SUPPORTED_CHAINS,
  getEvmTokenDecimals,
  getSolanaTokenDecimals,
} from '@wormhole-foundation/wormhole-monitor-common';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { SolanaPlatform } from '@wormhole-foundation/sdk-solana';
import { EvmNtt } from '@wormhole-foundation/sdk-evm-ntt';
import { SolanaNtt } from '@wormhole-foundation/sdk-solana-ntt';
import { Chain, Network, contracts, rpc } from '@wormhole-foundation/sdk-base';
import { EvmChains } from '@wormhole-foundation/sdk-evm';
import { Gauge } from 'prom-client';


const outboundCapacityGauge = new Gauge({
  name: 'ntt_outbound_capacity',
  help: 'NTT outbound capacity',
  labelNames: ['token', 'chain'],
});

const inboundCapacityGauge = new Gauge({
  name: 'ntt_inbound_capacity',
  help: 'NTT inbound capacity',
  labelNames: ['token', 'chain', 'inbound_chain'],
});

const PRODUCT = 'cloud_functions_ntt';

async function getEvmRateLimits(network: Network, chain: EvmChains, token: string) {
  const platform = new EvmPlatform(network);
  const evmNtt = new EvmNtt(network, chain as EvmChains, platform.getRpc(chain as EvmChains), {
    ntt: {
      token: NTT_TOKENS[network][token][chain as Chain] as string,
      manager: NTT_MANAGER_CONTRACT[network][token][chain as Chain] as string,
      transceiver: {
        wormhole: NTT_TRANSCEIVER_CONTRACT[network][token][chain as Chain] as string,
      },
    },
  });
  const tokenDecimals = await getEvmTokenDecimals(
    rpc.rpcAddress(network, chain as Chain),
    NTT_MANAGER_CONTRACT[network][token][chain as Chain]!
  );
  const outboundCapacity = await evmNtt.getCurrentOutboundCapacity();
  const outboundCapacityNormalized = outboundCapacity / BigInt(10 ** tokenDecimals);
  outboundCapacityGauge.set({ token, chain }, Number(outboundCapacityNormalized));

  console.log(`capacity for ${token} on ${chain}: ${outboundCapacityNormalized}`);
  for (const inboundChain of SUPPORTED_CHAINS(network, token)) {
    if (inboundChain === chain) continue;
    const inboundCapacity = await evmNtt.getCurrentInboundCapacity(inboundChain);
    const inboundCapacityNormalized = inboundCapacity / BigInt(10 ** tokenDecimals);
    inboundCapacityGauge.set(
      { token, chain, inbound_chain: inboundChain },
      Number(inboundCapacityNormalized)
    );

    console.log(
      `capacity for ${token} on ${chain} from ${inboundChain}: ${inboundCapacityNormalized}`
    );
  }
}

async function getSolanaRateLimits(network: Network, token: string) {
  const platform = new SolanaPlatform(network);
  const solNtt = new SolanaNtt(network, 'Solana', platform.getRpc('Solana'), {
    coreBridge: contracts.coreBridge(network, 'Solana'),
    ntt: {
      token: NTT_TOKENS[network][token].Solana as string,
      manager: NTT_MANAGER_CONTRACT[network][token].Solana as string,
      transceiver: {
        wormhole: NTT_TRANSCEIVER_CONTRACT[network][token].Solana as string,
      },
    },
  });

  const tokenDecimals = await getSolanaTokenDecimals(
    platform.getRpc('Solana').rpcEndpoint,
    NTT_TOKENS[network][token].Solana!
  );
  const outboundCapacity = await solNtt.getCurrentOutboundCapacity();
  const outboundCapacityNormalized = outboundCapacity / BigInt(10 ** tokenDecimals);
  outboundCapacityGauge.set({ token, chain: 'Solana' }, Number(outboundCapacityNormalized));

  console.log(`capacity for ${token} on Solana: ${outboundCapacityNormalized}`);
  for (const inboundChain of SUPPORTED_CHAINS(network, token)) {
    if (inboundChain === 'Solana') continue;
    const inboundCapacity = await solNtt.getCurrentInboundCapacity(inboundChain as Chain);
    const inboundCapacityNormalized = inboundCapacity / BigInt(10 ** tokenDecimals);
    inboundCapacityGauge.set(
      { token, chain: 'Solana', inbound_chain: inboundChain },
      Number(inboundCapacityNormalized)
    );

    console.log(
      `capacity for ${token} on Solana from ${inboundChain}: ${inboundCapacityNormalized}`
    );
  }
}

export async function pushNTTRateLimits(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  try {
    const network = assertEnvironmentVariable('NETWORK') as Network;
    const managerContracts = NTT_MANAGER_CONTRACT[network];

    for (const [token, manager] of Object.entries(managerContracts)) {
      for (const [chain, contract] of Object.entries(manager)) {
        if (!contract) continue;

        if (chain === 'Solana') {
          await getSolanaRateLimits(network, token);
        } else {
          await getEvmRateLimits(network, chain as EvmChains, token);
        }
      }
    }


    res.json({});
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}
