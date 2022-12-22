import { ChainName } from '@certusone/wormhole-sdk';

export const TIMEOUT = 0.5 * 1000;

// Notes about RPCs
// Ethereum
//   ethereum: "https://rpc.ankr.com/eth", // "finalized" does not work on Ankr as of 2022-12-16
// BSC
//   https://docs.bscscan.com/misc-tools-and-utilities/public-rpc-nodes
//   bsc: "https://bsc-dataseed1.binance.org", // Cannot read properties of undefined (reading 'error')
// Avalanche
//   https://docs.avax.network/apis/avalanchego/public-api-server
//   avalanche: "https://api.avax.network/ext/bc/C/rpc", // 500 error on batch request
// Fantom
//   fantom: "https://rpc.ftm.tools", // Cannot read properties of null (reading 'timestamp')"

export const EVM_RPCS_BY_CHAIN: { [key in ChainName]?: string } = {
  ethereum: process.env.ETH_RPC,
  bsc: 'https://rpc.ankr.com/bsc',
  polygon: 'https://rpc.ankr.com/polygon',
  avalanche: 'https://rpc.ankr.com/avalanche',
  oasis: 'https://emerald.oasis.dev',
  fantom: 'https://rpc.ankr.com/fantom',
  karura: 'https://eth-rpc-karura.aca-api.network',
  acala: 'https://eth-rpc-acala.aca-api.network',
  klaytn: 'https://public-node-api.klaytnapi.com/v1/cypress',
  celo: 'https://forno.celo.org',
  moonbeam: 'https://rpc.ankr.com/moonbeam',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
};

// Separating for now so if we max out infura we can keep Polygon going
export const POLYGON_ROOT_CHAIN_RPC = 'https://rpc.ankr.com/eth';
export const POLYGON_ROOT_CHAIN_ADDRESS = '0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287';

export const getMaximumBatchSize = (chain: ChainName): number =>
  chain === 'acala' || chain === 'karura' ? 50 : 100;

export const INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN: {
  [key in ChainName]?: string;
} = {
  ethereum: '12959638',
  bsc: '9745450',
  avalanche: '8237163',
  oasis: '1757',
  fantom: '31817467',
  karura: '1824665',
  acala: '1144161',
  klaytn: '90563824',
  celo: '12947144',
  moonbeam: '1486591',
  arbitrum: '18128584',
};

export const DB_SOURCE = process.env.DB_SOURCE || 'local';
export const DB_FILE = process.env.DB_FILE || '../server/db.json';
export const DB_LAST_BLOCK_FILE =
  process.env.DB_LAST_BLOCK_FILE || '../server/lastBlockByChain.json';
