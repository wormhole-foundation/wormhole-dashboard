import * as dotenv from 'dotenv';
dotenv.config();

import { initDb } from './databases/utils';
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
        'Bsc',
        // 'Polygon',
        'Avalanche',
        'Algorand',
        'Fantom',
        'Klaytn',
        'Celo',
        // 'Near',
        'Moonbeam',
        // 'Injective',
        'Sui',
        'Aptos',
        // 'Arbitrum',
        // 'Optimism',
        // 'Base',
        // 'Sei',
        'Scroll',
        'Wormchain',
        'Sepolia',
        'ArbitrumSepolia',
        'BaseSepolia',
        'OptimismSepolia',
        'Holesky',
        'PolygonSepolia',
        'Berachain',
        'Seievm',
        'Unichain',
        'Worldchain',
        'Monad',
        'Ink',
        'HyperEVM',
        // 'Movement',
        'Mezo',
        'Fogo',
        'Converge',
        'Plume',
        'XRPLEVM',
        'CreditCoin',
      ]
    : [
        // This is the list of chains supported in MAINNET.
        'Solana',
        'Ethereum',
        'Bsc',
        'Polygon',
        'Avalanche',
        'Algorand',
        'Fantom',
        'Klaytn',
        'Celo',
        'Near',
        'Moonbeam',
        'Injective',
        'Sui',
        'Aptos',
        'Arbitrum',
        'Optimism',
        'Base',
        'Sei',
        'Scroll',
        'Mantle',
        'Xlayer',
        'Berachain',
        'Unichain',
        'Worldchain',
        'Ink',
        'HyperEVM',
        'Wormchain',
        'Mezo',
        // uncomment after mainnet launch 'Fogo',
        'Plume',
        'XRPLEVM',
        'CreditCoin',
      ];

const supportedNTTChains: Chain[] =
  network === 'Testnet'
    ? ['Solana', 'Sepolia', 'ArbitrumSepolia', 'BaseSepolia', 'OptimismSepolia']
    : ['Solana', 'Ethereum', 'Fantom', 'Arbitrum', 'Optimism', 'Base'];

if (mode === 'vaa') {
  startSupervisor(supportedChains);
} else if (mode === 'ntt') {
  startSupervisor(supportedNTTChains);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
