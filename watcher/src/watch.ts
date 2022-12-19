import {
  ChainName,
  CONTRACTS,
  ethers_contracts,
  EVMChainName,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import {
  getMaximumBatchSize,
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  TIMEOUT,
} from "./consts";
import {
  getLastBlockByChain,
  makeBlockKey,
  makeVaaKey,
  storeVaasByBlock,
  VaasByBlock,
} from "./db";
import {
  createGetBlockByTagForEVM,
  createGetFinalizedBlockNumberForBSC,
  createGetFinalizedBlockNumberForMoonbeam,
  EVMProvider,
  getEVMProvider,
  getFinalizedBlockNumberForPolygon,
  getMessagesForBlocksEVM,
} from "./evm";
import { sleep } from "./utils";

export type GetFinalizedBlockNumberResult = Promise<number | null>;
export type GetFinalizedBlockNumber = () => GetFinalizedBlockNumberResult;
export type CreateGetFinalizedBlockNumber =
  () => () => GetFinalizedBlockNumberResult;
// The extra level of function call allows the creates to initialize providers lazily
// TODO: avoid ethers and their providers and we can avoid being lazy ;)
const notImplemented: CreateGetFinalizedBlockNumber = () => () => {
  throw new Error("Not Implemented");
};

const createGetFinalizedBlockNumberByChain: {
  [chain in ChainName]: CreateGetFinalizedBlockNumber;
} = {
  unset: notImplemented,
  solana: notImplemented,
  ethereum: () => createGetBlockByTagForEVM("ethereum", "finalized"),
  terra: notImplemented,
  bsc: () => createGetFinalizedBlockNumberForBSC(),
  polygon: () => getFinalizedBlockNumberForPolygon,
  avalanche: () => createGetBlockByTagForEVM("avalanche"),
  oasis: () => createGetBlockByTagForEVM("oasis"),
  algorand: notImplemented,
  aurora: notImplemented,
  fantom: () => createGetBlockByTagForEVM("fantom"),
  karura: () => createGetBlockByTagForEVM("karura", "finalized"),
  acala: () => createGetBlockByTagForEVM("acala", "finalized"),
  klaytn: () => createGetBlockByTagForEVM("klaytn"),
  celo: () => createGetBlockByTagForEVM("celo"),
  near: notImplemented,
  moonbeam: () => createGetFinalizedBlockNumberForMoonbeam(),
  neon: notImplemented,
  terra2: notImplemented,
  injective: notImplemented,
  osmosis: notImplemented,
  sui: notImplemented,
  aptos: notImplemented,
  arbitrum: notImplemented,
  optimism: notImplemented,
  gnosis: notImplemented,
  pythnet: notImplemented,
  xpla: notImplemented,
  btc: notImplemented,
  wormchain: notImplemented,
};

const notImplementedMessagesForBlocks = (
  chain: ChainName,
  fromBlock: number,
  toBlock: number,
  provider: EVMProvider
) => {
  throw new Error("Not Implemented");
};

const getMessagesForBlocks: {
  [chain in ChainName]: (
    chain: EVMChainName,
    fromBlock: number,
    toBlock: number,
    provider: EVMProvider
  ) => Promise<VaasByBlock>;
} = {
  unset: notImplementedMessagesForBlocks,
  solana: notImplementedMessagesForBlocks,
  ethereum: getMessagesForBlocksEVM,
  terra: notImplementedMessagesForBlocks,
  bsc: getMessagesForBlocksEVM,
  polygon: getMessagesForBlocksEVM,
  avalanche: getMessagesForBlocksEVM,
  oasis: getMessagesForBlocksEVM,
  algorand: notImplementedMessagesForBlocks,
  aurora: notImplementedMessagesForBlocks,
  fantom: getMessagesForBlocksEVM,
  karura: getMessagesForBlocksEVM,
  acala: getMessagesForBlocksEVM,
  klaytn: getMessagesForBlocksEVM,
  celo: getMessagesForBlocksEVM,
  near: notImplementedMessagesForBlocks,
  moonbeam: getMessagesForBlocksEVM,
  neon: notImplementedMessagesForBlocks,
  terra2: notImplementedMessagesForBlocks,
  injective: notImplementedMessagesForBlocks,
  osmosis: notImplementedMessagesForBlocks,
  sui: notImplementedMessagesForBlocks,
  aptos: notImplementedMessagesForBlocks,
  arbitrum: notImplementedMessagesForBlocks,
  optimism: notImplementedMessagesForBlocks,
  gnosis: notImplementedMessagesForBlocks,
  pythnet: notImplementedMessagesForBlocks,
  xpla: notImplementedMessagesForBlocks,
  btc: notImplementedMessagesForBlocks,
  wormchain: notImplementedMessagesForBlocks,
};

export async function watch(chain: ChainName) {
  if (!isEVMChain(chain)) {
    throw new Error(`Unsupported chain ${chain}`);
  }
  const provider = getEVMProvider(chain);
  const getFinalizedBlockNumber = createGetFinalizedBlockNumberByChain[chain]();
  let toBlock: number | null = await getFinalizedBlockNumber();
  const lastReadBlock: string | null =
    getLastBlockByChain(chain) ||
    INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain] ||
    null;
  let fromBlock: number | null =
    lastReadBlock !== null ? Number(lastReadBlock) : toBlock;
  while (true) {
    if (fromBlock && toBlock && fromBlock <= toBlock) {
      // fetch logs for the block range
      toBlock = Math.min(fromBlock + getMaximumBatchSize(chain) - 1, toBlock); // fix for "block range is too wide" or "maximum batch size is 50, but received 101"
      console.log("fetching", chain, "messages from", fromBlock, "to", toBlock);
      const vaasByBlock = await getMessagesForBlocks[chain](
        chain,
        fromBlock,
        toBlock,
        provider
      );
      storeVaasByBlock(chain, vaasByBlock);
      fromBlock = toBlock + 1;
    }
    await sleep(TIMEOUT);
    toBlock = await getFinalizedBlockNumber();
  }
}
