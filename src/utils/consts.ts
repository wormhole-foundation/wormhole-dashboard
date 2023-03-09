import {
  CHAIN_ID_SOLANA,
  CHAIN_ID_ETH,
  CHAIN_ID_TERRA,
  CHAIN_ID_BSC,
  CHAIN_ID_POLYGON,
  CHAIN_ID_AVAX,
  CHAIN_ID_OASIS,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AURORA,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_ACALA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_CELO,
  CHAIN_ID_TERRA2,
  ChainId,
  CHAIN_ID_NEAR,
} from "@certusone/wormhole-sdk";

require("dotenv").config();

export type CHAIN_INFO = {
  name: string;
  evm: boolean;
  chainId: ChainId;
  endpointUrl: any;
  platform: string;
  covalentChain: number;
  explorerStem: string;
  apiKey: string;
  urlStem: string;
};

export const CHAIN_INFO_MAP: { [key: string]: CHAIN_INFO } = {
  1: {
    name: "solana",
    evm: false,
    chainId: CHAIN_ID_SOLANA,
    urlStem: `https://public-api.solscan.io`,
    endpointUrl:
      process.env.REACT_APP_SOLANA_RPC || "https://api.mainnet-beta.solana.com",
    apiKey: "",
    platform: "solana",
    covalentChain: 1399811149,
    explorerStem: `https://solscan.io`,
  },
  2: {
    name: "eth",
    evm: true,
    chainId: CHAIN_ID_ETH,
    endpointUrl: process.env.REACT_APP_ETH_RPC || "https://rpc.ankr.com/eth",
    apiKey: "",
    urlStem: `https://api.etherscan.io`,
    platform: "ethereum",
    covalentChain: 1,
    explorerStem: `https://etherscan.io`,
  },
  3: {
    name: "terra",
    evm: false,
    chainId: CHAIN_ID_TERRA,
    endpointUrl: "",
    apiKey: "",
    urlStem: "https://columbus-fcd.terra.dev",
    platform: "terra",
    covalentChain: 3,
    explorerStem: `https://finder.terra.money/classic`,
  },
  4: {
    name: "bsc",
    evm: true,
    chainId: CHAIN_ID_BSC,
    endpointUrl:
      process.env.REACT_APP_BSC_RPC || "https://bsc-dataseed2.defibit.io",
    apiKey: "",
    urlStem: `https://api.bscscan.com`,
    platform: "binance-smart-chain",
    covalentChain: 56,
    explorerStem: `https://bscscan.com`,
  },
  5: {
    name: "polygon",
    evm: true,
    chainId: CHAIN_ID_POLYGON,
    endpointUrl: process.env.REACT_APP_POLYGON_RPC || "https://polygon-rpc.com",
    apiKey: "",
    urlStem: `https://api.polygonscan.com`,
    platform: "polygon-pos", //coingecko?,
    covalentChain: 137,
    explorerStem: `https://polygonscan.com`,
  },
  6: {
    name: "avalanche",
    evm: true,
    chainId: CHAIN_ID_AVAX,
    endpointUrl:
      process.env.REACT_APP_AVAX_RPC || "https://api.avax.network/ext/bc/C/rpc",
    apiKey: "",
    urlStem: `https://api.snowtrace.io`,
    platform: "avalanche", //coingecko?
    covalentChain: 43114,
    explorerStem: `https://snowtrace.io`,
  },
  7: {
    name: "oasis",
    evm: true,
    chainId: CHAIN_ID_OASIS,
    endpointUrl: "https://emerald.oasis.dev",
    apiKey: "",
    urlStem: `https://explorer.emerald.oasis.dev`,
    platform: "oasis", //coingecko?
    covalentChain: 0,
    explorerStem: `https://explorer.emerald.oasis.dev`,
  },
  8: {
    name: "algorand",
    evm: false,
    chainId: CHAIN_ID_ALGORAND,
    endpointUrl: "https://node.algoexplorerapi.io",
    apiKey: "",
    urlStem: `https://algoexplorer.io`,
    platform: "algorand", //coingecko?
    covalentChain: 0,
    explorerStem: `https://algoexplorer.io`,
  },
  9: {
    name: "aurora",
    evm: true,
    chainId: CHAIN_ID_AURORA,
    endpointUrl: "https://mainnet.aurora.dev",
    apiKey: "",
    urlStem: `https://api.aurorascan.dev`, //?module=account&action=txlist&address={addressHash}
    covalentChain: 1313161554,
    platform: "aurora", //coingecko?
    explorerStem: `https://aurorascan.dev`,
  },
  10: {
    name: "fantom",
    evm: true,
    chainId: CHAIN_ID_FANTOM,
    endpointUrl: "https://rpc.ftm.tools",
    apiKey: "",
    urlStem: `https://api.FtmScan.com`,
    platform: "fantom", //coingecko?
    covalentChain: 250,
    explorerStem: `https://ftmscan.com`,
  },
  11: {
    name: "karura",
    evm: true,
    chainId: CHAIN_ID_KARURA,
    endpointUrl: "https://eth-rpc-karura.aca-api.network",
    apiKey: "",
    urlStem: `https://blockscout.karura.network`,
    platform: "karura", //coingecko?
    covalentChain: 0,
    explorerStem: `https://blockscout.karura.network`,
  },
  12: {
    name: "acala",
    evm: true,
    chainId: CHAIN_ID_ACALA,
    endpointUrl: "https://eth-rpc-acala.aca-api.network",
    apiKey: "",
    urlStem: `https://blockscout.acala.network`,
    platform: "acala", //coingecko?
    covalentChain: 0,
    explorerStem: `https://blockscout.acala.network`,
  },
  13: {
    name: "klaytn",
    evm: true,
    chainId: CHAIN_ID_KLAYTN,
    endpointUrl: "https://klaytn-mainnet-rpc.allthatnode.com:8551",
    apiKey: "",
    urlStem: "https://api-cypress-v2.scope.klaytn.com/v2" || "",
    platform: "klay-token", //coingecko?
    covalentChain: 8217,
    explorerStem: `https://scope.klaytn.com`,
  },
  14: {
    name: "celo",
    evm: true,
    chainId: CHAIN_ID_CELO,
    endpointUrl: "https://forno.celo.org",
    apiKey: "",
    urlStem: `https://explorer.celo.org`,
    platform: "celo", //coingecko?
    covalentChain: 0,
    explorerStem: `https://explorer.celo.org`,
  },
  15: {
    name: "near",
    evm: false,
    chainId: CHAIN_ID_NEAR,
    endpointUrl: "",
    apiKey: "",
    urlStem: `https://explorer.near.org`,
    platform: "near", //coingecko?
    covalentChain: 0,
    explorerStem: `https://explorer.near.org`,
  },
  18: {
    name: "terra2",
    evm: false,
    chainId: CHAIN_ID_TERRA2,
    endpointUrl: "",
    apiKey: "",
    urlStem: "https://phoenix-fcd.terra.dev",
    platform: "terra",
    covalentChain: 3,
    explorerStem: `https://finder.terra.money/mainnet`,
  },
};

export const JUMP_GUARDIAN_ADDRESS = "58cc3ae5c097b213ce3c81979e1b9f9570746aa5";
export const ACCOUNTANT_CONTRACT_ADDRESS =
  "wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465";

export const GUARDIAN_SET_3 = [
  {
    pubkey: "0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5",
    name: "Jump Crypto",
  },
  {
    pubkey: "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157",
    name: "Staked",
  },
  {
    pubkey: "0x114De8460193bdf3A2fCf81f86a09765F4762fD1",
    name: "Figment",
  },
  {
    pubkey: "0x107A0086b32d7A0977926A205131d8731D39cbEB",
    name: "ChainodeTech",
  },
  {
    pubkey: "0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2",
    name: "Inotel",
  },
  {
    pubkey: "0x11b39756C042441BE6D8650b69b54EbE715E2343",
    name: "HashQuark",
  },
  {
    pubkey: "0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd",
    name: "Chainlayer",
  },
  {
    pubkey: "0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20",
    name: "xLabs",
  },
  {
    pubkey: "0x74a3bf913953D695260D88BC1aA25A4eeE363ef0",
    name: "Forbole",
  },
  {
    pubkey: "0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e",
    name: "Staking Fund",
  },
  {
    pubkey: "0xAF45Ced136b9D9e24903464AE889F5C8a723FC14",
    name: "MoonletWallet",
  },
  {
    pubkey: "0xf93124b7c738843CBB89E864c862c38cddCccF95",
    name: "P2P.ORG Validator",
  },
  {
    pubkey: "0xD2CC37A4dc036a8D232b48f62cDD4731412f4890",
    name: "01Node",
  },
  {
    pubkey: "0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811",
    name: "MCF",
  },
  {
    pubkey: "0x71AA1BE1D36CaFE3867910F99C09e347899C19C3",
    name: "Everstake",
  },
  {
    pubkey: "0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf",
    name: "Chorus One",
  },
  {
    pubkey: "0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8",
    name: "Syncnode",
  },
  {
    pubkey: "0x5E1487F35515d02A92753504a8D75471b9f49EdB",
    name: "Triton",
  },
  {
    pubkey: "0x6FbEBc898F403E4773E95feB15E80C9A99c8348d",
    name: "Staking Facilities",
  },
];
