import * as dotenv from 'dotenv';
dotenv.config();

import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { initDb } from './databases/utils';
import { makeFinalizedNTTWatcher, makeFinalizedWatcher } from './watchers/utils';
import {
  Environment,
  Mode,
  getEnvironment,
  getMode,
} from '@wormhole-foundation/wormhole-monitor-common';

initDb();

const network: Environment = getEnvironment();
const mode: Mode = getMode();

// NOTE:  supportedChains is in chainId order

const supportedChains: ChainName[] =
  network === 'testnet'
    ? [
        // NOTE:  The commented out chains are left in there to easily
        //        identify which chains are not supported on testnet.
        'solana',
        // 'ethereum',
        // 'terra',
        'bsc',
        'polygon',
        'avalanche',
        'oasis',
        'algorand',
        'fantom',
        // 'karura',
        'acala',
        'klaytn',
        'celo',
        // 'near',
        'moonbeam',
        // 'terra2',
        // 'injective',
        'sui',
        'aptos',
        // 'arbitrum',
        // 'optimism',
        'xpla',
        // 'base',
        'sei',
        // 'wormchain',
        'sepolia',
        'arbitrum_sepolia',
        'base_sepolia',
        'optimism_sepolia',
        'holesky',
        'polygon_sepolia',
      ]
    : [
        // This is the list of chains supported in MAINNET.
        'solana',
        'ethereum',
        'terra',
        'bsc',
        'polygon',
        'avalanche',
        'oasis',
        'algorand',
        'fantom',
        'karura',
        'acala',
        'klaytn',
        'celo',
        'near',
        'moonbeam',
        'terra2',
        'injective',
        'sui',
        'aptos',
        'arbitrum',
        'optimism',
        'xpla',
        'base',
        'sei',
        'wormchain',
      ];

const supportedNTTChains: ChainName[] =
  network === 'testnet'
    ? ['solana', 'sepolia', 'arbitrum_sepolia', 'base_sepolia', 'optimism_sepolia']
    : [];

if (mode === 'vaa') {
  for (const chain of supportedChains) {
    makeFinalizedWatcher(network, chain).watch();
  }
} else if (mode === 'ntt') {
  for (const chain of supportedNTTChains) {
    makeFinalizedNTTWatcher(network, chain).watch();
  }
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
