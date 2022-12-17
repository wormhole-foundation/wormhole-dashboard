import {
  ChainName,
  CONTRACTS,
  ethers_contracts,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { EVM_RPCS_BY_CHAIN, INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN } from "./consts";
import {
  getLastBlockByChain,
  makeBlockKey,
  makeVaaKey,
  storeVaasByBlock,
  VaasByBlock,
} from "./db";

const TIMEOUT = 5 * 1000;
const MAX_RANGE = 100;

async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

async function getFinalizedBlockNumber(
  provider: ethers.providers.JsonRpcProvider,
  finalizedBlockTag: ethers.providers.BlockTag
): Promise<number | null> {
  try {
    const block = await provider.getBlock(finalizedBlockTag);
    return block.number;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function watch(
  chain: ChainName,
  finalizedBlockTag: ethers.providers.BlockTag
) {
  const wormholeInterface =
    ethers_contracts.Implementation__factory.createInterface();
  const provider = new ethers.providers.JsonRpcProvider(
    EVM_RPCS_BY_CHAIN[chain]
  );
  let toBlock: number | null = await getFinalizedBlockNumber(
    provider,
    finalizedBlockTag
  );
  const lastReadBlock: string | null =
    getLastBlockByChain(chain) ||
    INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain] ||
    null;
  let fromBlock: number | null =
    lastReadBlock !== null ? Number(lastReadBlock) : toBlock;
  while (true) {
    if (fromBlock && toBlock && fromBlock <= toBlock) {
      // fetch logs for the block range
      toBlock = Math.min(fromBlock + MAX_RANGE, toBlock); // fix for "block range is too wide"
      console.log("fetching", chain, "logs from", fromBlock, "to", toBlock);
      // TODO: fix avax "requested to block 23734227 after last accepted block 23734226"
      const logs = await provider.getLogs({
        fromBlock,
        toBlock,
        address: CONTRACTS.MAINNET[chain].core,
        topics: [
          "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2",
        ],
      });
      const timestampsByBlock: { [block: number]: string } = {};
      // fetch timestamps for each block
      const vaasByBlock: VaasByBlock = {};
      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        await sleep(100);
        console.log("fetching info for", chain, "block", blockNumber);
        const block = await provider.getBlock(blockNumber);
        // TODO: fix "Cannot read properties of null (reading 'timestamp')" (fantom)
        if (!block) {
          console.error("bad block", blockNumber, "from", chain);
        }
        const timestamp = new Date(block.timestamp * 1000).toISOString();
        timestampsByBlock[blockNumber] = timestamp;
        vaasByBlock[makeBlockKey(blockNumber.toString(), timestamp)] = [];
      }
      console.log("processing", logs.length, chain, "logs");
      for (const log of logs) {
        const blockNumber = log.blockNumber;
        const emitter = log.topics[1].slice(2);
        const {
          args: { sequence },
        } = wormholeInterface.parseLog(log);
        const vaaKey = makeVaaKey(
          log.transactionHash,
          chain,
          emitter,
          sequence.toString()
        );
        const blockKey = makeBlockKey(
          blockNumber.toString(),
          timestampsByBlock[blockNumber]
        );
        vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
      }
      storeVaasByBlock(chain, vaasByBlock);
      fromBlock = toBlock + 1;
    }
    await sleep(TIMEOUT);
    toBlock = await getFinalizedBlockNumber(provider, finalizedBlockTag);
  }
}
