import { VaasByBlock } from '../databases/types';
import { Watcher } from './Watcher';
import { CosmwasmWatcher } from './CosmwasmWatcher';
import { TerraExplorerWatcher } from './TerraExplorerWatcher';

// This watcher contains a cosmwasm watcher and an explorer watcher
export class TerraHybridWatcher extends Watcher {
  cwWatcher: CosmwasmWatcher;
  explorerWatcher: TerraExplorerWatcher;
  latestBlockHeight: number;

  constructor() {
    super('terra2');
    this.latestBlockHeight = 0;
    // Need to worry about how RPCs are provided via tunables.
    this.cwWatcher = new CosmwasmWatcher('terra2');
    this.explorerWatcher = new TerraExplorerWatcher('terra2');
  }

  // Get the latest block number from the cosmwasm watcher
  async getFinalizedBlockNumber(): Promise<number> {
    return await this.cwWatcher.getFinalizedBlockNumber();
  }

  // Get the messages from the explorer watcher
  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    return await this.explorerWatcher.getMessagesForBlocks(fromBlock, toBlock);
  }
}
