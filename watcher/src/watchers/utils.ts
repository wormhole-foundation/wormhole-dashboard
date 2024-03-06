import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
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
import { Environment } from '@wormhole-foundation/wormhole-monitor-common';
import { NTTWatcher } from './NTTWatcher';
import { NTTArbitrumWatcher } from './NTTArbitrumWatcher';

export function makeFinalizedWatcher(network: Environment, chainName: ChainName): Watcher {
  if (chainName === 'solana') {
    return new SolanaWatcher(network);
  } else if (chainName === 'ethereum' || chainName === 'karura' || chainName === 'acala') {
    return new EVMWatcher(network, chainName, 'finalized');
  } else if (chainName === 'bsc') {
    return new BSCWatcher(network);
  } else if (
    chainName === 'avalanche' ||
    chainName === 'oasis' ||
    chainName === 'fantom' ||
    chainName === 'klaytn' ||
    chainName === 'polygon' ||
    chainName === 'celo' ||
    chainName === 'optimism' ||
    chainName === 'base'
  ) {
    return new EVMWatcher(network, chainName);
  } else if (chainName === 'algorand') {
    return new AlgorandWatcher(network);
  } else if (chainName === 'moonbeam') {
    return new MoonbeamWatcher(network);
  } else if (chainName === 'arbitrum') {
    return new ArbitrumWatcher(network);
  } else if (chainName === 'aptos') {
    return new AptosWatcher(network);
  } else if (chainName === 'near') {
    return new NearArchiveWatcher(network);
  } else if (chainName === 'injective') {
    return new InjectiveExplorerWatcher(network);
  } else if (chainName === 'sei') {
    return new SeiExplorerWatcher(network);
  } else if (chainName === 'terra') {
    return new TerraExplorerWatcher(network, chainName);
  } else if (chainName === 'xpla' || chainName === 'terra2') {
    return new CosmwasmWatcher(network, chainName);
  } else if (chainName === 'sui') {
    return new SuiWatcher(network);
  } else if (chainName === 'wormchain') {
    return new WormchainWatcher(network);
  } else if (network === 'testnet') {
    // These are testnet only chains
    if (chainName === 'sepolia' || chainName === 'holesky') {
      return new EVMWatcher(network, chainName, 'finalized');
    } else if (chainName === 'arbitrum_sepolia') {
      return new ArbitrumWatcher(network);
    } else if (
      chainName === 'optimism_sepolia' ||
      chainName === 'base_sepolia' ||
      chainName === 'polygon_sepolia'
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

export function makeFinalizedNTTWatcher(network: Environment, chainName: ChainName): Watcher {
  if (network === 'testnet') {
    // These are testnet only chains
    if (chainName === 'sepolia' || chainName === 'holesky') {
      return new NTTWatcher(network, chainName, 'finalized');
    } else if (chainName === 'base_sepolia' || chainName === 'optimism_sepolia') {
      return new NTTWatcher(network, chainName);
    } else if (chainName === 'arbitrum_sepolia') {
      return new NTTArbitrumWatcher(network);
    } else {
      throw new Error(
        `Attempted to create finalized watcher for unsupported testnet chain ${chainName}`
      );
    }
  } else {
    throw new Error(`Attempted to create finalized watcher for unsupported chain ${chainName}`);
  }
}
