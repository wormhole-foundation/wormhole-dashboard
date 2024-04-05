import { Network } from '@wormhole-foundation/sdk-base';
import { EVMWatcher } from './EVMWatcher';

export class BSCWatcher extends EVMWatcher {
  constructor(network: Network) {
    super(network, 'Bsc');
  }
  async getFinalizedBlockNumber(): Promise<number> {
    const latestBlock = await super.getFinalizedBlockNumber();
    return Math.max(latestBlock - 15, 0);
  }
}
