import { AlgorandWatcher } from './AlgorandWatcher';
import { AptosWatcher } from './AptosWatcher';
import { ArbitrumWatcher } from './ArbitrumWatcher';
import { BSCWatcher } from './BSCWatcher';
import { CosmwasmWatcher } from './CosmwasmWatcher';
import { EVMWatcher } from './EVMWatcher';
import { InjectiveExplorerWatcher } from './InjectiveExplorerWatcher';
import { MoonbeamWatcher } from './MoonbeamWatcher';
import { SolanaWatcher } from './SolanaWatcher';
import { TerraExplorerWatcher } from './TerraExplorerWatcher';
import { Watcher } from './Watcher';
import { SuiWatcher } from './SuiWatcher';
import { SeiExplorerWatcher } from './SeiExplorerWatcher';
import { WormchainWatcher } from './WormchainWatcher';
import { NearArchiveWatcher } from './NearArchiveWatcher';
import { NTTWatcher } from './NTTWatcher';
import { NTTArbitrumWatcher } from './NTTArbitrumWatcher';
import { NTTSolanaWatcher } from './NTTSolanaWatcher';
import { Chain, Network } from '@wormhole-foundation/sdk-base';
import { FTEVMWatcher } from './FTEVMWatcher';
import { FTSolanaWatcher } from './FTSolanaWatcher';
import { isFTEVMChain } from '../fastTransfer/consts';

export function makeFinalizedWatcher(network: Network, chainName: Chain): Watcher {
  if (chainName === 'Solana') {
    return new SolanaWatcher(network);
  } else if (chainName === 'Ethereum' || chainName === 'Karura' || chainName === 'Acala') {
    return new EVMWatcher(network, chainName, 'finalized');
  } else if (chainName === 'Bsc') {
    return new BSCWatcher(network);
  } else if (
    chainName === 'Avalanche' ||
    chainName === 'Oasis' ||
    chainName === 'Fantom' ||
    chainName === 'Klaytn' ||
    chainName === 'Polygon' ||
    chainName === 'Celo' ||
    chainName === 'Optimism' ||
    chainName === 'Scroll' ||
    chainName === 'Mantle' ||
    chainName === 'Blast' ||
    chainName === 'Xlayer' ||
    chainName === 'Berachain' ||
    chainName === 'Snaxchain' ||
    chainName === 'Unichain' ||
    chainName === 'Worldchain' ||
    chainName === 'MonadDevnet' ||
    chainName === 'Ink' ||
    chainName === 'Base'
  ) {
    return new EVMWatcher(network, chainName);
  } else if (chainName === 'Algorand') {
    return new AlgorandWatcher(network);
  } else if (chainName === 'Moonbeam') {
    return new MoonbeamWatcher(network);
  } else if (chainName === 'Arbitrum') {
    return new ArbitrumWatcher(network);
  } else if (chainName === 'Aptos') {
    return new AptosWatcher(network);
  } else if (chainName === 'Near') {
    return new NearArchiveWatcher(network);
  } else if (chainName === 'Injective') {
    return new InjectiveExplorerWatcher(network);
  } else if (chainName === 'Sei') {
    return new SeiExplorerWatcher(network);
  } else if (chainName === 'Terra') {
    return new TerraExplorerWatcher(network, chainName);
  } else if (chainName === 'Terra2') {
    return new CosmwasmWatcher(network, chainName);
  } else if (chainName === 'Xpla') {
    return new CosmwasmWatcher(network, chainName);
  } else if (chainName === 'Sui') {
    return new SuiWatcher(network);
  } else if (chainName === 'Wormchain') {
    return new WormchainWatcher(network);
  } else if (network === 'Testnet') {
    // These are testnet only chains
    if (chainName === 'Sepolia' || chainName === 'Holesky') {
      return new EVMWatcher(network, chainName, 'finalized');
    } else if (chainName === 'ArbitrumSepolia') {
      return new ArbitrumWatcher(network);
    } else if (
      chainName === 'OptimismSepolia' ||
      chainName === 'BaseSepolia' ||
      chainName === 'PolygonSepolia'
    ) {
      return new EVMWatcher(network, chainName);
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
    if (chainName === 'Ethereum') {
      return new NTTWatcher(network, chainName, 'finalized');
    } else if (chainName === 'Fantom' || chainName === 'Base' || chainName === 'Optimism') {
      return new NTTWatcher(network, chainName);
    } else if (chainName === 'Arbitrum') {
      return new NTTArbitrumWatcher(network);
    } else if (chainName === 'Solana') {
      return new NTTSolanaWatcher(network);
    } else {
      throw new Error(
        `Attempted to create finalized NTT watcher for unsupported mainnet chain ${chainName}`
      );
    }
  } else if (network === 'Testnet') {
    // These are testnet only chains
    if (chainName === 'Sepolia' || chainName === 'Holesky') {
      return new NTTWatcher(network, chainName, 'finalized');
    } else if (chainName === 'BaseSepolia' || chainName === 'OptimismSepolia') {
      return new NTTWatcher(network, chainName);
    } else if (chainName === 'ArbitrumSepolia') {
      return new NTTArbitrumWatcher(network);
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
    return new FTEVMWatcher(network, chainName, 'finalized');
  } else {
    throw new Error(
      `Attempted to create finalized FT watcher for unsupported chain ${chainName} on ${network}`
    );
  }
}
