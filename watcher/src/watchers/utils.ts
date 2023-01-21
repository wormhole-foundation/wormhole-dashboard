import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { AlgorandWatcher } from './AlgorandWatcher';
import { AptosWatcher } from './AptosWatcher';
import { ArbitrumWatcher } from './ArbitrumWatcher';
import { BSCWatcher } from './BSCWatcher';
import { CosmwasmWatcher } from './CosmwasmWatcher';
import { EVMWatcher } from './EVMWatcher';
import { MoonbeamWatcher } from './MoonbeamWatcher';
import { NearWatcher } from './NearWatcher';
import { OptimismWatcher } from './OptimismWatcher';
import { PolygonWatcher } from './PolygonWatcher';
import { SolanaWatcher } from './SolanaWatcher';
import { Watcher } from './Watcher';

export function makeFinalizedWatcher(chainName: ChainName): Watcher {
  if (chainName === 'solana') {
    return new SolanaWatcher();
  } else if (chainName === 'ethereum' || chainName === 'karura' || chainName === 'acala') {
    return new EVMWatcher(chainName, 'finalized');
  } else if (chainName === 'bsc') {
    return new BSCWatcher();
  } else if (chainName === 'polygon') {
    return new PolygonWatcher();
  } else if (
    chainName === 'avalanche' ||
    chainName === 'oasis' ||
    chainName === 'fantom' ||
    chainName === 'klaytn' ||
    chainName === 'celo'
  ) {
    return new EVMWatcher(chainName);
  } else if (chainName === 'algorand') {
    return new AlgorandWatcher();
  } else if (chainName === 'moonbeam') {
    return new MoonbeamWatcher();
  } else if (chainName === 'arbitrum') {
    return new ArbitrumWatcher();
  } else if (chainName === 'optimism') {
    return new OptimismWatcher();
  } else if (chainName === 'aptos') {
    return new AptosWatcher();
  } else if (chainName === 'near') {
    return new NearWatcher();
  } else if (
    chainName === 'terra' ||
    chainName === 'terra2' ||
    chainName === 'xpla' ||
    chainName === 'injective'
  ) {
    return new CosmwasmWatcher(chainName);
  } else {
    throw new Error(`Attempted to create finalized watcher for unsupported chain ${chainName}`);
  }
}
