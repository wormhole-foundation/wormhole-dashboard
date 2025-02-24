import { Network, PlatformToChains } from '@wormhole-foundation/sdk-base';
import { BlockTag, EVMWatcher } from './EVMWatcher';

export class VAAWatcher extends EVMWatcher {
  constructor(
    network: Network,
    chain: PlatformToChains<'Evm'>,
    finalizedBlockTag: BlockTag = 'finalized'
  ) {
    super(network, chain, finalizedBlockTag, 'vaa');
  }
}
