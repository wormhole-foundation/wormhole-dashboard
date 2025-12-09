import { AlgorandWatcher } from './AlgorandWatcher';
import { AptosWatcher } from './AptosWatcher';
import { InjectiveExplorerWatcher } from './InjectiveExplorerWatcher';
import { Watcher } from './Watcher';
import { SuiWatcher } from './SuiWatcher';
import { SeiExplorerWatcher } from './SeiExplorerWatcher';
import { WormchainWatcher } from './WormchainWatcher';
import { NearArchiveWatcher } from './NearArchiveWatcher';
import { NTTWatcher } from './NTTWatcher';
import { NTTSolanaWatcher } from './NTTSolanaWatcher';
import { Chain, Network } from '@wormhole-foundation/sdk-base';
import { VAAWatcher } from './VAAWatcher';
import { SVMWatcher } from './SVMWatcher';

export function makeFinalizedVaaWatcher(network: Network, chainName: Chain): Watcher {
  if (chainName === 'Solana' || chainName === 'Fogo') {
    return new SVMWatcher(network, chainName);
  } else if (
    chainName === 'Arbitrum' ||
    chainName === 'Avalanche' ||
    chainName === 'Base' ||
    chainName === 'Berachain' ||
    chainName === 'Bsc' ||
    chainName === 'Celo' ||
    chainName === 'Ethereum' ||
    chainName === 'HyperEVM' ||
    chainName === 'Ink' ||
    chainName === 'Mantle' ||
    chainName === 'Monad' ||
    chainName === 'Moonbeam' ||
    chainName === 'Optimism' ||
    chainName === 'Polygon' ||
    chainName === 'Scroll' ||
    chainName === 'Seievm' ||
    chainName === 'Unichain' ||
    chainName === 'Worldchain' ||
    chainName === 'Xlayer' ||
    chainName === 'Mezo' ||
    chainName === 'Sonic' ||
    chainName === 'Converge' ||
    chainName === 'Plume' ||
    chainName === 'XRPLEVM' ||
    chainName === 'CreditCoin' ||
    chainName === 'Moca' ||
    chainName === 'MegaETH'
  ) {
    return new VAAWatcher(network, chainName);
  } else if (chainName === 'Fantom' || chainName === 'Klaytn') {
    return new VAAWatcher(network, chainName, 'latest');
  } else if (chainName === 'Algorand') {
    return new AlgorandWatcher(network);
  } else if (chainName === 'Aptos' /*|| chainName === 'Movement'*/) {
    return new AptosWatcher(network, chainName);
  } else if (chainName === 'Injective') {
    return new InjectiveExplorerWatcher(network);
  } else if (chainName === 'Near') {
    return new NearArchiveWatcher(network);
  } else if (chainName === 'Sei') {
    return new SeiExplorerWatcher(network);
  } else if (chainName === 'Sui') {
    return new SuiWatcher(network);
  } else if (chainName === 'Wormchain') {
    return new WormchainWatcher(network);
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
