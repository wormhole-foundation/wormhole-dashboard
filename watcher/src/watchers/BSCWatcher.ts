import { Environment } from '@wormhole-foundation/wormhole-monitor-common';
import { EVMWatcher } from './EVMWatcher';

export class BSCWatcher extends EVMWatcher {
  constructor(network: Environment) {
    super(network, 'Bsc');
  }
  async getFinalizedBlockNumber(): Promise<number> {
    const latestBlock = await super.getFinalizedBlockNumber();
    return Math.max(latestBlock - 15, 0);
  }
}
