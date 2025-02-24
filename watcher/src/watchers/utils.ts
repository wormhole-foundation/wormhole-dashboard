import { AlgorandWatcher } from './AlgorandWatcher';
import { AptosWatcher } from './AptosWatcher';
import { CosmwasmWatcher } from './CosmwasmWatcher';
import { InjectiveExplorerWatcher } from './InjectiveExplorerWatcher';
import { SolanaWatcher } from './SolanaWatcher';
import { TerraExplorerWatcher } from './TerraExplorerWatcher';
import { Watcher } from './Watcher';
import { SuiWatcher } from './SuiWatcher';
import { SeiExplorerWatcher } from './SeiExplorerWatcher';
import { WormchainWatcher } from './WormchainWatcher';
import { NearArchiveWatcher } from './NearArchiveWatcher';
import { NTTWatcher } from './NTTWatcher';
import { NTTSolanaWatcher } from './NTTSolanaWatcher';
import { Chain, Network } from '@wormhole-foundation/sdk-base';
import { FTEVMWatcher } from './FTEVMWatcher';
import { FTSolanaWatcher } from './FTSolanaWatcher';
import { isFTEVMChain } from '../fastTransfer/consts';
import { VAAWatcher } from './VAAWatcher';

export function makeFinalizedVaaWatcher(network: Network, chainName: Chain): Watcher {
  if (chainName === 'Solana') {
    return new SolanaWatcher(network);
  } else if (
    chainName === 'Acala' ||
    chainName === 'Arbitrum' ||
    chainName === 'Avalanche' ||
    chainName === 'Base' ||
    chainName === 'Berachain' ||
    chainName === 'Blast' ||
    chainName === 'Bsc' ||
    chainName === 'Celo' ||
    chainName === 'Ethereum' ||
    chainName === 'Fantom' ||
    chainName === 'HyperEVM' ||
    chainName === 'Ink' ||
    chainName === 'Karura' ||
    chainName === 'Klaytn' ||
    chainName === 'Mantle' ||
    chainName === 'Monad' ||
    chainName === 'Moonbeam' ||
    chainName === 'Oasis' ||
    chainName === 'Optimism' ||
    chainName === 'Polygon' ||
    chainName === 'Scroll' ||
    chainName === 'Seievm' ||
    chainName === 'Snaxchain' ||
    chainName === 'Unichain' ||
    chainName === 'Worldchain' ||
    chainName === 'Xlayer'
  ) {
    return new VAAWatcher(network, chainName);
  } else if (chainName === 'Algorand') {
    return new AlgorandWatcher(network);
  } else if (chainName === 'Aptos') {
    return new AptosWatcher(network);
  } else if (chainName === 'Injective') {
    return new InjectiveExplorerWatcher(network);
  } else if (chainName === 'Near') {
    return new NearArchiveWatcher(network);
  } else if (chainName === 'Sei') {
    return new SeiExplorerWatcher(network);
  } else if (chainName === 'Sui') {
    return new SuiWatcher(network);
  } else if (chainName === 'Terra') {
    return new TerraExplorerWatcher(network, chainName);
  } else if (chainName === 'Terra2') {
    return new CosmwasmWatcher(network, chainName);
  } else if (chainName === 'Wormchain') {
    return new WormchainWatcher(network);
  } else if (chainName === 'Xpla') {
    return new CosmwasmWatcher(network, chainName);
  } else if (network === 'Testnet') {
    // These are testnet only chains
    if (
      chainName === 'ArbitrumSepolia' ||
      chainName === 'BaseSepolia' ||
      chainName === 'Holesky' ||
      chainName === 'OptimismSepolia' ||
      chainName === 'PolygonSepolia' ||
      chainName === 'Sepolia'
    ) {
      return new VAAWatcher(network, chainName);
    } else {
      throw new Error(
        `Attempted to create finalized watcher for unsupported testnet chain ${chainName}`
      );
    }
  } else {
    throw new Error(`Attempted to create finalized watcher for unsupported chain ${chainName}`);
  }
}

export function makeFinalizedNTTWatcher(network: Network, chainName: Chain): Watcher {
  if (network === 'Mainnet') {
    if (
      chainName === 'Arbitrum' ||
      chainName === 'Base' ||
      chainName === 'Ethereum' ||
      chainName === 'Fantom' ||
      chainName === 'Optimism'
    ) {
      return new NTTWatcher(network, chainName);
    } else if (chainName === 'Solana') {
      return new NTTSolanaWatcher(network);
    } else {
      throw new Error(
        `Attempted to create finalized NTT watcher for unsupported mainnet chain ${chainName}`
      );
    }
  } else if (network === 'Testnet') {
    // These are testnet only chains
    if (
      chainName === 'ArbitrumSepolia' ||
      chainName === 'BaseSepolia' ||
      chainName === 'Holesky' ||
      chainName === 'OptimismSepolia' ||
      chainName === 'Sepolia'
    ) {
      return new NTTWatcher(network, chainName);
    } else if (chainName === 'Solana') {
      return new NTTSolanaWatcher(network);
    } else {
      throw new Error(
        `Attempted to create finalized NTT watcher for unsupported testnet chain ${chainName}`
      );
    }
  } else {
    throw new Error(
      `Attempted to create finalized NTT watcher for unsupported network ${network}, ${chainName}`
    );
  }
}

export function makeFinalizedFTWatcher(network: Network, chainName: Chain): Watcher {
  if (chainName === 'Solana') {
    return new FTSolanaWatcher(network);
  } else if (isFTEVMChain(chainName, network)) {
    return new FTEVMWatcher(network, chainName);
  } else {
    throw new Error(
      `Attempted to create finalized FT watcher for unsupported chain ${chainName} on ${network}`
    );
  }
}
