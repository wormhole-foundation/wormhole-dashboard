import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Chain } from '@wormhole-foundation/sdk-base';
import { Environment } from '@wormhole-foundation/wormhole-monitor-common';
import { AxiosRequestConfig } from 'axios';

export const TIMEOUT = 0.5 * 1000;
export const HB_INTERVAL = 5 * 60 * 1000; // 5 Minutes
export type WorkerData = {
  network: Environment;
  chain: Chain;
};

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

export const RPCS_BY_CHAIN: { [key in Environment]: { [key in Chain]?: string } } = {
  ['mainnet']: {
    Ethereum: process.env.ETH_RPC,
    Bsc: process.env.BSC_RPC || 'https://bsc.publicnode.com',
    Polygon: process.env.POLYGON_RPC || 'https://rpc.ankr.com/polygon',
    Avalanche: process.env.AVALANCHE_RPC || 'https://rpc.ankr.com/avalanche',
    Oasis: process.env.OASIS_RPC || 'https://emerald.oasis.dev',
    Algorand: process.env.ALGORAND_RPC || 'https://mainnet-api.algonode.cloud',
    Fantom: process.env.FANTOM_RPC || 'https://rpc.ankr.com/fantom',
    Karura: process.env.KARURA_RPC || 'https://eth-rpc-karura.aca-api.network',
    Acala: process.env.ACALA_RPC || 'https://eth-rpc-acala.aca-api.network',
    Klaytn: process.env.KLAYTN_RPC || 'https://klaytn-mainnet-rpc.allthatnode.com:8551',
    Celo: process.env.CELO_RPC || 'https://forno.celo.org',
    Moonbeam: process.env.MOONBEAM_RPC || 'https://rpc.ankr.com/moonbeam',
    Arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    Optimism: process.env.OPTIMISM_RPC || 'https://rpc.ankr.com/optimism',
    Aptos: process.env.APTOS_RPC || 'https://fullnode.mainnet.aptoslabs.com/',
    Near: process.env.NEAR_RPC || 'https://rpc.mainnet.near.org',
    Xpla: process.env.XPLA_RPC || 'https://dimension-lcd.xpla.dev',
    Terra2: process.env.TERRA2_RPC || 'https://phoenix-lcd.terra.dev',
    // Terra: 'https://columbus-fcd.terra.dev',
    Terra: process.env.TERRA_RPC || 'https://terra-classic-fcd.publicnode.com',
    Injective: process.env.INJECTIVE_RPC || 'https://sentry.exchange.grpc-web.injective.network',
    Solana: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    Sui: process.env.SUI_RPC || 'https://rpc.mainnet.sui.io',
    Base: process.env.BASE_RPC || 'https://developer-access-mainnet.base.org',
    Sei: process.env.SEI_RPC || 'https://sei-rest.brocha.in', // https://docs.sei.io/develop/resources
    Wormchain: process.env.WORMCHAIN_RPC || 'https://wormchain-rpc.quickapi.com',
  },
  ['testnet']: {
    Ethereum: process.env.ETH_RPC,
    Bsc: process.env.BSC_RPC,
    Polygon: process.env.POLYGON_RPC || 'https://rpc.ankr.com/polygon_mumbai',
    Avalanche: process.env.AVALANCHE_RPC || 'https://rpc.ankr.com/avalanche_fuji',
    Oasis: process.env.OASIS_RPC || 'https://testnet.emerald.oasis.dev',
    Algorand: process.env.ALGORAND_RPC || 'https://testnet-api.algonode.cloud',
    Fantom: process.env.FANTOM_RPC,
    Karura: process.env.KARURA_RPC,
    Acala: process.env.ACALA_RPC || 'https://eth-rpc-acala-testnet.aca-staging.network',
    Klaytn: process.env.KLAYTN_RPC || 'https://rpc.ankr.com/klaytn_testnet',
    Celo: process.env.CELO_RPC || 'https://alfajores-forno.celo-testnet.org',
    Moonbeam: process.env.MOONBEAM_RPC,
    Arbitrum: process.env.ARBITRUM_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    Optimism: process.env.OPTIMISM_RPC || 'https://optimism-goerli.publicnode.com',
    Aptos: process.env.APTOS_RPC,
    Near: process.env.NEAR_RPC,
    Xpla: process.env.XPLA_RPC || 'https://cube-lcd.xpla.dev',
    Terra2: process.env.TERRA2_RPC || 'https://pisco-lcd.terra.dev',
    Terra: process.env.TERRA_RPC,
    Injective: process.env.INJECTIVE_RPC,
    Solana: process.env.SOLANA_RPC,
    Sui: process.env.SUI_RPC,
    Base: process.env.BASE_RPC,
    Sei: process.env.SEI_RPC,
    Wormchain: process.env.WORMCHAIN_RPC,
    ArbitrumSepolia: process.env.ARBITRUM_SEPOLIA_RPC,
    BaseSepolia: process.env.BASE_SEPOLIA_RPC,
    OptimismSepolia: process.env.OPTIMISM_SEPOLIA_RPC,
    Holesky: process.env.HOLESKY_RPC,
    Sepolia: process.env.SEPOLIA_RPC,
    PolygonSepolia: process.env.POLYGON_SEPOLIA_RPC || 'https://rpc-amoy.polygon.technology',
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
    algodServer: RPCS_BY_CHAIN['mainnet'].Algorand
      ? (RPCS_BY_CHAIN['mainnet'].Algorand as string)
      : '',
    algodPort: 443,
    server: 'https://mainnet-idx.algonode.cloud',
    port: 443,
    token: '',
  },
  ['testnet']: {
    appid: Number(CONTRACTS.TESTNET.algorand.core),
    algodToken: '',
    algodServer: RPCS_BY_CHAIN['testnet'].Algorand
      ? (RPCS_BY_CHAIN['testnet'].Algorand as string)
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
