import { CeloProvider } from "@celo-tools/celo-ethers-wrapper";
import {
  ChainName,
  CONTRACTS,
  ethers_contracts,
} from "@certusone/wormhole-sdk";
import axios from "axios";
import { ethers } from "ethers";
import {
  EVM_RPCS_BY_CHAIN,
  getMaximumBatchSize,
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  POLYGON_ROOT_CHAIN_ADDRESS,
  POLYGON_ROOT_CHAIN_RPC,
} from "./consts";
import {
  getLastBlockByChain,
  makeBlockKey,
  makeVaaKey,
  storeVaasByBlock,
  VaasByBlock,
} from "./db";

const TIMEOUT = 0.5 * 1000;

async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

// TODO: Refactor into object with explicit functions build per chain
async function getFinalizedBlockNumber(
  provider:
    | ethers.providers.JsonRpcProvider
    | ethers.providers.JsonRpcBatchProvider
    | CeloProvider,
  chain: ChainName
): Promise<number | null> {
  if (chain === "polygon") {
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
  // Only Ethereum, Acala, and Karura support the "finalized" tag
  const finalizedBlockTag: ethers.providers.BlockTag =
    chain === "ethereum" || chain === "karura" || chain === "acala"
      ? "finalized"
      : "latest";
  try {
    console.log("fetching", finalizedBlockTag, "block from", chain);
    const block = await provider.getBlock(finalizedBlockTag);
    if (chain === "bsc") {
      return block.number - 15;
    } else if (chain === "moonbeam") {
      let isBlockFinalized = false;
      while (!isBlockFinalized) {
        if (!EVM_RPCS_BY_CHAIN.moonbeam) {
          throw new Error("Moonbeam RPC is not defined!");
        }
        await sleep(100);
        // refetch the block by number to get an up-to-date hash
        try {
          const blockFromNumber = await provider.getBlock(block.number);
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
            block.number
          );
        }
      }
    }
    return block.number;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function watch(chain: ChainName) {
  const wormholeInterface =
    ethers_contracts.Implementation__factory.createInterface();
  let provider:
    | ethers.providers.JsonRpcProvider
    | ethers.providers.JsonRpcBatchProvider
    | CeloProvider;
  if (chain === "celo") {
    provider = new CeloProvider(EVM_RPCS_BY_CHAIN[chain]);
  } else {
    provider = new ethers.providers.JsonRpcBatchProvider(
      EVM_RPCS_BY_CHAIN[chain]
    );
  }
  let toBlock: number | null = await getFinalizedBlockNumber(provider, chain);
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
      const blockPromises = [];
      console.log(
        "fetching info for",
        chain,
        "blocks",
        fromBlock,
        "to",
        toBlock
      );
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
      storeVaasByBlock(chain, vaasByBlock);
      fromBlock = toBlock + 1;
    }
    await sleep(TIMEOUT);
    toBlock = await getFinalizedBlockNumber(provider, chain);
  }
}
