import * as dotenv from 'dotenv';
dotenv.config();

import { initDb } from './databases/utils';
import { makeFinalizedNTTWatcher, makeFinalizedWatcher } from './watchers/utils';
import { Mode, getNetwork, getMode } from '@wormhole-foundation/wormhole-monitor-common';
import { startSupervisor } from './workers/supervisor';
import { Chain, Network } from '@wormhole-foundation/sdk-base';

initDb();

const network: Network = getNetwork();
const mode: Mode = getMode();

// NOTE:  supportedChains is in chainId order

const supportedChains: Chain[] =
  network === 'Testnet'
    ? [
        // NOTE:  The commented out chains are left in there to easily
        //        identify which chains are not supported on testnet.
        'Solana',
        // 'Ethereum',
        // 'Terra',
        'Bsc',
        'Polygon',
        'Avalanche',
        'Oasis',
        'Algorand',
        'Fantom',
        // 'Karura',
        'Acala',
        'Klaytn',
        'Celo',
        // 'Near',
        'Moonbeam',
        // 'Terra2',
        // 'Injective',
        'Sui',
        'Aptos',
        // 'Arbitrum',
        // 'Optimism',
        'Xpla',
        // 'Base',
        'Sei',
        // 'Wormchain',
        'Sepolia',
        'ArbitrumSepolia',
        'BaseSepolia',
        'OptimismSepolia',
        'Holesky',
        'PolygonSepolia',
      ]
    : [
        // This is the list of chains supported in MAINNET.
        'Solana',
        'Ethereum',
        'Terra',
        'Bsc',
        'Polygon',
        'Avalanche',
        'Oasis',
        'Algorand',
        'Fantom',
        'Karura',
        'Acala',
        'Klaytn',
        'Celo',
        'Near',
        'Moonbeam',
        'Terra2',
        'Injective',
        'Sui',
        'Aptos',
        'Arbitrum',
        'Optimism',
        'Xpla',
        'Base',
        'Sei',
        'Wormchain',
      ];

const supportedNTTChains: Chain[] =
  network === 'Testnet'
    ? ['Solana', 'Sepolia', 'ArbitrumSepolia', 'BaseSepolia', 'OptimismSepolia']
    : [];

if (mode === 'vaa') {
  for (const chain of supportedChains) {
    makeFinalizedWatcher(network, chain).watch();
  }
  startSupervisor(supportedChains);
} else if (mode === 'ntt') {
  for (const chain of supportedNTTChains) {
    makeFinalizedNTTWatcher(network, chain).watch();
  }
  startSupervisor(supportedNTTChains);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
