import { Network, PlatformToChains } from '@wormhole-foundation/sdk-base';
import { BlockTag, EVMWatcher } from './EVMWatcher';

export class VAAWatcher extends EVMWatcher {
  constructor(
    network: Network,
    chain: PlatformToChains<'Evm'>,
    finalizedBlockTag: BlockTag = 'latest'
  ) {
    super(network, chain, finalizedBlockTag, 'vaa');
    // Special cases for batch size
    if (chain === 'Acala' || chain === 'Karura' || chain === 'Berachain') {
      this.maximumBatchSize = 50;
    } else if (
      chain === 'Blast' ||
      chain === 'Klaytn' ||
      chain === 'Scroll' ||
      chain === 'Snaxchain' ||
      chain === 'Unichain' ||
      chain === 'Worldchain' ||
      chain === 'Monad' ||
      chain === 'MonadDevnet' ||
      chain === 'Ink' ||
      chain === 'HyperEVM' ||
      chain === 'Seievm' ||
      chain === 'Xlayer'
    ) {
      this.maximumBatchSize = 10;
    }
    // Special cases for watch loop delay
    if (chain === 'Berachain') {
      this.watchLoopDelay = 1000;
    }
  }
}
