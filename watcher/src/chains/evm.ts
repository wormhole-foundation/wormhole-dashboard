import { CeloProvider } from "@celo-tools/celo-ethers-wrapper";
import {
  ChainName,
  CONTRACTS,
  ethers_contracts,
  EVMChainName,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { EVM_RPCS_BY_CHAIN } from "../consts";
import { makeBlockKey, makeVaaKey, VaasByBlock } from "../db";
import { GetFinalizedBlockNumberResult } from "../watch";

export type EVMProvider =
  | ethers.providers.JsonRpcProvider
  | ethers.providers.JsonRpcBatchProvider
  | CeloProvider;

const wormholeInterface =
  ethers_contracts.Implementation__factory.createInterface();

const initializedEVMProviders: { [chain in ChainName]?: EVMProvider } = {};

export function getEVMProvider(chain: EVMChainName): EVMProvider {
  if (!initializedEVMProviders[chain]) {
    if (chain === "celo") {
      initializedEVMProviders[chain] = new CeloProvider(
        EVM_RPCS_BY_CHAIN[chain]
      );
    } else {
      initializedEVMProviders[chain] =
        new ethers.providers.JsonRpcBatchProvider(EVM_RPCS_BY_CHAIN[chain]);
    }
  }
  return initializedEVMProviders[chain] as EVMProvider;
}

export async function safeGetBlockByTag(
  chain: ChainName,
  blockNumberOrTag: "finalized" | "latest",
  provider: EVMProvider
): Promise<number | null> {
  try {
    console.log("fetching block", blockNumberOrTag, "from", chain);
    const block = await provider.getBlock(blockNumberOrTag);
    return block.number;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createGetBlockByTagForEVM(
  chain: EVMChainName,
  finalizedBlockTag: "finalized" | "latest" = "latest"
) {
  const provider = getEVMProvider(chain);
  return async (): GetFinalizedBlockNumberResult =>
    safeGetBlockByTag(chain, finalizedBlockTag, provider);
}

export async function getMessagesForBlocksEVM(
  chain: EVMChainName,
  fromBlock: number,
  toBlock: number
): Promise<VaasByBlock> {
  const provider = getEVMProvider(chain);
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
  const blockPromises = [];
  console.log("fetching info for", chain, "blocks", fromBlock, "to", toBlock);
  for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
    blockPromises.push(provider.getBlock(blockNumber));
  }
  const blocks = await Promise.all(blockPromises);
  for (const block of blocks) {
    // TODO: fix "Cannot read properties of null (reading 'timestamp')" (fantom)
    if (!block) {
      console.error("bad block from", chain);
    }
    const timestamp = new Date(block.timestamp * 1000).toISOString();
    timestampsByBlock[block.number] = timestamp;
    vaasByBlock[makeBlockKey(block.number.toString(), timestamp)] = [];
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
  return vaasByBlock;
}
