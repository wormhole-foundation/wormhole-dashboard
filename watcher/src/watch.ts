import { ChainName, EVMChainName, isEVMChain } from '@certusone/wormhole-sdk';
import { createGetFinalizedBlockNumberForBSC } from './chains/bsc';
import { createGetBlockByTagForEVM, EVMProvider, getMessagesForBlocksEVM } from './chains/evm';
import { createGetFinalizedBlockNumberForMoonbeam } from './chains/moonbeam';
import { getFinalizedBlockNumberForPolygon } from './chains/polygon';
import { getMaximumBatchSize, INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN, TIMEOUT } from './consts';
import { getLastBlockByChain, storeVaasByBlock, VaasByBlock } from './db';
import { sleep } from './utils';

export type GetFinalizedBlockNumberResult = Promise<number | null>;
export type GetFinalizedBlockNumber = () => GetFinalizedBlockNumberResult;
// The extra level of function call allows the creates to initialize providers lazily
// TODO: avoid ethers and their providers and we can avoid being lazy ;)
export type CreateGetFinalizedBlockNumber = () => () => GetFinalizedBlockNumberResult;

export type GetMessagesForBlocksResult = Promise<VaasByBlock>;
export type GetMessagesForBlocks = (
  chain: EVMChainName,
  fromBlock: number,
  toBlock: number
) => GetMessagesForBlocksResult;

export type Watcher = {
  getFinalizedBlockNumber: GetFinalizedBlockNumber;
  getMessagesForBlocks: GetMessagesForBlocks;
};

const createUnimplementedWatcher = (): Watcher => ({
  getFinalizedBlockNumber: () => {
    throw new Error('Not Implemented');
  },
  getMessagesForBlocks: () => {
    throw new Error('Not Implemented');
  },
});

const createWatcherByChain: {
  [chain in ChainName]: () => Watcher;
} = {
  unset: createUnimplementedWatcher,
  solana: createUnimplementedWatcher,
  ethereum: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('ethereum', 'finalized'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  terra: createUnimplementedWatcher,
  bsc: () => ({
    getFinalizedBlockNumber: createGetFinalizedBlockNumberForBSC(),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  polygon: () => ({
    getFinalizedBlockNumber: getFinalizedBlockNumberForPolygon,
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  avalanche: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('avalanche'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  oasis: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('oasis'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  algorand: createUnimplementedWatcher,
  aurora: createUnimplementedWatcher,
  fantom: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('fantom'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  karura: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('karura', 'finalized'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  acala: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('acala', 'finalized'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  klaytn: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('klaytn'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  celo: () => ({
    getFinalizedBlockNumber: createGetBlockByTagForEVM('celo'),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  near: createUnimplementedWatcher,
  moonbeam: () => ({
    getFinalizedBlockNumber: createGetFinalizedBlockNumberForMoonbeam(),
    getMessagesForBlocks: getMessagesForBlocksEVM,
  }),
  neon: createUnimplementedWatcher,
  terra2: createUnimplementedWatcher,
  injective: createUnimplementedWatcher,
  osmosis: createUnimplementedWatcher,
  sui: createUnimplementedWatcher,
  aptos: createUnimplementedWatcher,
  arbitrum: createUnimplementedWatcher,
  optimism: createUnimplementedWatcher,
  gnosis: createUnimplementedWatcher,
  pythnet: createUnimplementedWatcher,
  xpla: createUnimplementedWatcher,
  btc: createUnimplementedWatcher,
  wormchain: createUnimplementedWatcher,
};

export async function watch(chain: ChainName) {
  if (!isEVMChain(chain)) {
    throw new Error(`Unsupported chain ${chain}`);
  }
  const watcher = createWatcherByChain[chain]();
  let toBlock: number | null = await watcher.getFinalizedBlockNumber();
  const lastReadBlock: string | null = getLastBlockByChain(chain) || INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain] || null;
  let fromBlock: number | null = lastReadBlock !== null ? Number(lastReadBlock) : toBlock;
  while (true) {
    if (fromBlock && toBlock && fromBlock <= toBlock) {
      // fetch logs for the block range
      toBlock = Math.min(fromBlock + getMaximumBatchSize(chain) - 1, toBlock); // fix for "block range is too wide" or "maximum batch size is 50, but received 101"
      console.log('fetching', chain, 'messages from', fromBlock, 'to', toBlock);
      const vaasByBlock = await watcher.getMessagesForBlocks(chain, fromBlock, toBlock);
      storeVaasByBlock(chain, vaasByBlock);
      fromBlock = toBlock + 1;
    }
    await sleep(TIMEOUT);
    toBlock = await watcher.getFinalizedBlockNumber();
  }
}
