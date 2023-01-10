import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';

export const INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN: {
  [key in ChainName]?: string;
} = {
  ethereum: '12959638',
  terra: '4810000', // not sure exactly but this should be before the first known message
  bsc: '9745450',
  polygon: '20629146',
  avalanche: '8237163',
  oasis: '1757',
  algorand: '23753839',
  fantom: '31817467',
  karura: '1824665',
  acala: '1144161',
  klaytn: '90563824',
  celo: '12947144',
  moonbeam: '1486591',
  terra2: '399813',
  injective: '20908376',
  arbitrum: '18128584',
  aptos: '0', // block is 1094390 but AptosWatcher uses sequence number instead
  near: '72767136',
  xpla: '777549',
  solana: '96383501',
};
