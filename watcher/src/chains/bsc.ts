import { EVMWatcher } from './evm';

export class BSCWatcher extends EVMWatcher {
  constructor() {
    super('bsc');
  }
  async getFinalizedBlockNumber(): Promise<number | null> {
    const latestBlock = await super.getFinalizedBlockNumber();
    if (latestBlock !== null) {
      return Math.max(latestBlock - 15, 0);
    }
    return null;
  }
}
