import { ChainName, CONTRACTS, Network } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Environment } from '@wormhole-foundation/wormhole-monitor-common';
import { AxiosRequestConfig } from 'axios';

export const TIMEOUT = 0.5 * 1000;

// Notes about RPCs
// Ethereum
//   ethereum: "https://rpc.ankr.com/eth", // "finalized" does not work on Ankr as of 2022-12-16
// BSC
//   https://docs.bscscan.com/misc-tools-and-utilities/public-rpc-nodes
//   bsc: "https://bsc-dataseed1.binance.org", // Cannot read properties of undefined (reading 'error')
//   'https://rpc.ankr.com/bsc' has been very slow, trying a diff rpc
// Avalanche
//   https://docs.avax.network/apis/avalanchego/public-api-server
//   avalanche: "https://api.avax.network/ext/bc/C/rpc", // 500 error on batch request
// Fantom
//   fantom: "https://rpc.ftm.tools", // Cannot read properties of null (reading 'timestamp')"
// Klaytn
// this one immediately 429s
// klaytn: 'https://public-node-api.klaytnapi.com/v1/cypress',
// Near
//   archive node
//   https://archival-rpc.mainnet.near.org
// Arbitrum
//  This node didn't work:  'https://arb1.arbitrum.io/rpc',

export const RPCS_BY_CHAIN: { [key in Environment]: { [key in ChainName]?: string } } = {
  ['mainnet']: {
    ethereum: process.env.ETH_RPC,
    bsc: process.env.BSC_RPC || 'https://bsc.publicnode.com',
    polygon: process.env.POLYGON_RPC || 'https://rpc.ankr.com/polygon',
    avalanche: process.env.AVALANCHE_RPC || 'https://rpc.ankr.com/avalanche',
    oasis: process.env.OASIS_RPC || 'https://emerald.oasis.dev',
    algorand: process.env.ALGORAND_RPC || 'https://mainnet-api.algonode.cloud',
    fantom: process.env.FANTOM_RPC || 'https://rpc.ankr.com/fantom',
    karura: process.env.KARURA_RPC || 'https://eth-rpc-karura.aca-api.network',
    acala: process.env.ACALA_RPC || 'https://eth-rpc-acala.aca-api.network',
    klaytn: process.env.KLAYTN_RPC || 'https://klaytn-mainnet-rpc.allthatnode.com:8551',
    celo: process.env.CELO_RPC || 'https://forno.celo.org',
    moonbeam: process.env.MOONBEAM_RPC || 'https://rpc.ankr.com/moonbeam',
    arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    optimism: process.env.OPTIMISM_RPC || 'https://rpc.ankr.com/optimism',
    aptos: process.env.APTOS_RPC || 'https://fullnode.mainnet.aptoslabs.com/',
    near: process.env.NEAR_RPC || 'https://rpc.mainnet.near.org',
    xpla: process.env.XPLA_RPC || 'https://dimension-lcd.xpla.dev',
    terra2: process.env.TERRA2_RPC || 'https://phoenix-lcd.terra.dev',
    // terra: 'https://columbus-fcd.terra.dev',
    terra: process.env.TERRA_RPC || 'https://terra-classic-fcd.publicnode.com',
    injective: process.env.INJECTIVE_RPC || 'https://api.injective.network',
    solana: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    sui: process.env.SUI_RPC || 'https://rpc.mainnet.sui.io',
    base: process.env.BASE_RPC || 'https://developer-access-mainnet.base.org',
    sei: process.env.SEI_RPC || 'https://sei-rest.brocha.in', // https://docs.sei.io/develop/resources
    wormchain: process.env.WORMCHAIN_RPC || 'https://wormchain-rpc.quickapi.com',
  },
  ['testnet']: {
    ethereum: process.env.ETH_RPC,
    bsc: process.env.BSC_RPC,
    polygon: process.env.POLYGON_RPC || 'https://rpc.ankr.com/polygon_mumbai',
    avalanche: process.env.AVALANCHE_RPC || 'https://rpc.ankr.com/avalanche_fuji',
    oasis: process.env.OASIS_RPC || 'https://testnet.emerald.oasis.dev',
    algorand: process.env.ALGORAND_RPC || 'https://testnet-api.algonode.cloud',
    fantom: process.env.FANTOM_RPC,
    karura: process.env.KARURA_RPC,
    acala: process.env.ACALA_RPC || 'https://eth-rpc-acala-testnet.aca-staging.network',
    klaytn: process.env.KLAYTN_RPC || 'https://rpc.ankr.com/klaytn_testnet',
    celo: process.env.CELO_RPC || 'https://alfajores-forno.celo-testnet.org',
    moonbeam: process.env.MOONBEAM_RPC,
    arbitrum: process.env.ARBITRUM_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    optimism: process.env.OPTIMISM_RPC || 'https://optimism-goerli.publicnode.com',
    aptos: process.env.APTOS_RPC,
    near: process.env.NEAR_RPC,
    xpla: process.env.XPLA_RPC || 'https://cube-lcd.xpla.dev',
    terra2: process.env.TERRA2_RPC || 'https://pisco-lcd.terra.dev',
    terra: process.env.TERRA_RPC,
    injective: process.env.INJECTIVE_RPC,
    solana: process.env.SOLANA_RPC,
    sui: process.env.SUI_RPC,
    base: process.env.BASE_RPC,
    sei: process.env.SEI_RPC,
    wormchain: process.env.WORMCHAIN_RPC,
    sepolia: process.env.SEPOLIA_RPC,
  },
  ['devnet']: {},
};

// The following is obsolete, but I'm leaving it here for now in case we need it later.
// Separating for now so if we max out infura we can keep Polygon going
export const POLYGON_ROOT_CHAIN_INFO: { [key in Environment]: PolygonRootChainInfo } = {
  ['mainnet']: {
    address: '0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287',
    rpc: 'https://rpc.ankr.com/eth',
  },
  ['testnet']: {
    address: '0x2890ba17efe978480615e330ecb65333b880928e',
    rpc: 'https://rpc.ankr.com/eth', // TODO:  Put testnet info here
  },
  ['devnet']: {
    address: '',
    rpc: '',
  },
};

export const ALGORAND_INFO: { [key in Environment]: AlgorandInfo } = {
  ['mainnet']: {
    appid: Number(CONTRACTS.MAINNET.algorand.core),
    algodToken: '',
    algodServer: RPCS_BY_CHAIN['mainnet'].algorand
      ? (RPCS_BY_CHAIN['mainnet'].algorand as string)
      : '',
    algodPort: 443,
    server: 'https://mainnet-idx.algonode.cloud',
    port: 443,
    token: '',
  },
  ['testnet']: {
    appid: Number(CONTRACTS.TESTNET.algorand.core),
    algodToken: '',
    algodServer: RPCS_BY_CHAIN['testnet'].algorand
      ? (RPCS_BY_CHAIN['testnet'].algorand as string)
      : '',
    algodPort: 443,
    server: 'https://testnet-idx.algonode.cloud',
    port: 443,
    token: '',
  },
  ['devnet']: {
    appid: 0,
    algodToken: '',
    algodServer: '',
    algodPort: 0,
    server: '',
    port: 0,
    token: '',
  },
};

export const SEI_EXPLORER_GRAPHQL_MAINNET = 'https://pacific-1-graphql.alleslabs.dev/v1/graphql';
export const SEI_EXPLORER_TXS_MAINNET =
  'https://celatone-api-prod.alleslabs.dev/v1/sei/pacific-1/txs/';
export const SEI_EXPLORER_GRAPHQL_TESTNET = 'https://atlantic-2-graphql.alleslabs.dev/v1/graphql';
export const SEI_EXPLORER_TXS_TESTNET =
  'https://celatone-api-prod.alleslabs.dev/v1/sei/atlantic-2/txs/';

export const DB_SOURCE =
  process.env.NODE_ENV === 'test' ? 'local' : process.env.DB_SOURCE || 'local';
export const JSON_DB_FILE = process.env.JSON_DB_FILE || './db.json';
export const DB_LAST_BLOCK_FILE = process.env.DB_LAST_BLOCK_FILE || './lastBlockByChain.json';

// without this, axios request will error `Z_BUF_ERROR`: https://github.com/axios/axios/issues/5346
export const AXIOS_CONFIG_JSON: AxiosRequestConfig = {
  headers: { 'Accept-Encoding': 'application/json' },
};

export const GUARDIAN_RPC_HOSTS: { [key in Environment]: string[] } = {
  ['mainnet']: [
    'https://api.wormholescan.io',
    'https://wormhole-v2-mainnet-api.mcf.rocks',
    'https://wormhole-v2-mainnet-api.chainlayer.network',
    'https://wormhole-v2-mainnet-api.staking.fund',
  ],
  ['testnet']: ['https://api.testnet.wormholescan.io'],
  ['devnet']: [],
};

export type AlgorandInfo = {
  appid: number;
  algodToken: string;
  algodServer: string;
  algodPort: number;
  server: string;
  port: number;
  token: string;
};

export type PolygonRootChainInfo = {
  address: string;
  rpc: string;
};
