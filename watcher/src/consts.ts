import { ChainName } from "@certusone/wormhole-sdk";
require("dotenv").config();

export const EVM_RPCS_BY_CHAIN: { [key in ChainName]?: string } = {
  // "finalized" does not work on Ankr as of 2022-12-16
  // ethereum: "https://rpc.ankr.com/eth",
  ethereum: process.env.ETH_RPC,
  bsc: "https://rpc.ankr.com/bsc",
  polygon: "https://rpc.ankr.com/polygon",
  avalanche: "https://rpc.ankr.com/avalanche",
  oasis: "https://emerald.oasis.dev",
  fantom: "https://rpc.ftm.tools",
  karura: "https://eth-rpc-karura.aca-api.network",
  acala: "https://eth-rpc-acala.aca-api.network",
  klaytn: "https://public-node-api.klaytnapi.com/v1/cypress",
  celo: "https://forno.celo.org",
  moonbeam: "https://rpc.ankr.com/moonbeam",
  arbitrum: "https://arb1.arbitrum.io/rpc",
};

export const INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN: {
  [key in ChainName]?: string;
} = {
  ethereum: "12959638",
  avalanche: "8237163",
  oasis: "1757",
  fantom: "31817467",
  karura: "1824665",
  acala: "1144161",
  klaytn: "90563824",
  celo: "12947144",
  moonbeam: "1486591",
  arbitrum: "18128584",
};
