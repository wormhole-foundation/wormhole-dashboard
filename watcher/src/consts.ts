import { ChainName } from "@certusone/wormhole-sdk";
require("dotenv").config();

export const EVM_RPCS_BY_CHAIN: { [key in ChainName]?: string } = {
  // "finalized" does not work on Ankr as of 2022-12-16
  // ethereum: "https://rpc.ankr.com/eth",
  ethereum: process.env.ETH_RPC,
  bsc: "https://rpc.ankr.com/bsc",
  polygon: "https://rpc.ankr.com/polygon",
  avalanche: "https://rpc.ankr.com/avalanche",
};
