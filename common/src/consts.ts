import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';

export const INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN: {
  [key in ChainName]?: string;
} = {
  ethereum: '12959638',
  bsc: '9745450',
  polygon: '20629146',
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
