import { CeloProvider } from "@celo-tools/celo-ethers-wrapper";
import {
  ChainName,
  CONTRACTS,
  ethers_contracts,
  EVMChainName,
} from "@certusone/wormhole-sdk";
import axios from "axios";
import { ethers } from "ethers";
import {
  EVM_RPCS_BY_CHAIN,
  POLYGON_ROOT_CHAIN_ADDRESS,
  POLYGON_ROOT_CHAIN_RPC,
} from "./consts";
import { makeBlockKey, makeVaaKey, VaasByBlock } from "./db";
import { sleep } from "./utils";
import { GetFinalizedBlockNumberResult } from "./watch";

const wormholeInterface =
  ethers_contracts.Implementation__factory.createInterface();

async function safeGetBlockByTag(
  chain: ChainName,
  blockNumberOrTag: "finalized" | "latest",
  provider:
    | ethers.providers.JsonRpcProvider
    | ethers.providers.JsonRpcBatchProvider
    | CeloProvider
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

export type EVMProvider =
  | ethers.providers.JsonRpcProvider
  | ethers.providers.JsonRpcBatchProvider
  | CeloProvider;

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

export function createGetBlockByTagForEVM(
  chain: EVMChainName,
  finalizedBlockTag: "finalized" | "latest" = "latest"
) {
  const provider = getEVMProvider(chain);
  return async (): GetFinalizedBlockNumberResult =>
    safeGetBlockByTag(chain, finalizedBlockTag, provider);
}

export function createGetFinalizedBlockNumberForBSC() {
  const getLatestBlock = createGetBlockByTagForEVM("bsc");
  return async (): GetFinalizedBlockNumberResult => {
    const latestBlock = await getLatestBlock();
    if (latestBlock !== null) {
      return Math.max(latestBlock - 15, 0);
    }
    return null;
  };
}

export function createGetFinalizedBlockNumberForMoonbeam() {
  const provider = getEVMProvider("moonbeam");
  return async (): GetFinalizedBlockNumberResult => {
    const latestBlock = await safeGetBlockByTag("moonbeam", "latest", provider);
    if (latestBlock !== null) {
      let isBlockFinalized = false;
      while (!isBlockFinalized) {
        if (!EVM_RPCS_BY_CHAIN.moonbeam) {
          throw new Error("Moonbeam RPC is not defined!");
        }
        await sleep(100);
        // refetch the block by number to get an up-to-date hash
        try {
          const blockFromNumber = await provider.getBlock(latestBlock);
          isBlockFinalized =
            (
              await axios.post(EVM_RPCS_BY_CHAIN.moonbeam, [
                {
                  jsonrpc: "2.0",
                  id: "1",
                  method: "moon_isBlockFinalized",
                  params: [blockFromNumber.hash],
                },
              ])
            )?.data?.[0]?.result || false;
        } catch (e) {
          console.error(
            "Error while trying to check for finality of Moonbeam block",
            latestBlock
          );
        }
      }
    }
    return null;
  };
}

export async function getFinalizedBlockNumberForPolygon(): GetFinalizedBlockNumberResult {
  console.log("fetching Polygon last child block from Ethereum");
  const rootChain = new ethers.utils.Interface([
    `function getLastChildBlock() external view returns (uint256)`,
  ]);
  const callData = rootChain.encodeFunctionData("getLastChildBlock");
  try {
    const callResult = (
      await axios.post(POLYGON_ROOT_CHAIN_RPC, [
        {
          jsonrpc: "2.0",
          id: "1",
          method: "eth_call",
          params: [
            { to: POLYGON_ROOT_CHAIN_ADDRESS, data: callData },
            "latest", // does the guardian use latest?
          ],
        },
      ])
    )?.data?.[0]?.result;
    const block = rootChain
      .decodeFunctionResult("getLastChildBlock", callResult)[0]
      .toNumber();
    console.log("rooted child block", block);
    return block;
  } catch (e) {
    console.error("error fetching last child block");
    return null;
  }
}

export async function getMessagesForBlocksEVM(
  chain: EVMChainName,
  fromBlock: number,
  toBlock: number,
  provider: EVMProvider
): Promise<VaasByBlock> {
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
