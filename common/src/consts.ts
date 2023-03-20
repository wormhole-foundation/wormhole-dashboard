import {
  ChainId,
  ChainName,
  coalesceChainName,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';

export const INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN: {
  [key in ChainName]?: string;
} = {
  ethereum: '12959638',
  terra: '4810000', // not sure exactly but this should be before the first known message
  bsc: '9745450',
  polygon: '20629146',
  avalanche: '8237163',
  oasis: '1757',
  algorand: '22931277',
  fantom: '31817467',
  karura: '1824665',
  acala: '1144161',
  klaytn: '90563824',
  celo: '12947144',
  moonbeam: '1486591',
  terra2: '399813',
  injective: '20908376',
  arbitrum: '18128584',
  optimism: '69401779',
  aptos: '0', // block is 1094390 but AptosWatcher uses sequence number instead
  near: '72767136',
  xpla: '777549',
  solana: '94401321', // https://explorer.solana.com/tx/KhLy688yDxbP7xbXVXK7TGpZU5DAFHbYiaoX16zZArxvVySz8i8g7N7Ss2noQYoq9XRbg6HDzrQBjUfmNcSWwhe
};

export const TOKEN_BRIDGE_EMITTERS: { [key in ChainName]?: string } = {
  solana: 'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
  ethereum: '0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585',
  terra: '0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2',
  terra2: 'a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3',
  bsc: '000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7',
  polygon: '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde',
  avalanche: '0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052',
  oasis: '0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564',
  algorand: '67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45',
  aptos: '0000000000000000000000000000000000000000000000000000000000000001',
  aurora: '00000000000000000000000051b5123a7b0f9b2ba265f9c4c8de7d78d52f510f',
  fantom: '0000000000000000000000007c9fc5741288cdfdd83ceb07f3ea7e22618d79d2',
  karura: '000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624',
  acala: '000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624',
  klaytn: '0000000000000000000000005b08ac39eaed75c0439fc750d9fe7e1f9dd0193f',
  celo: '000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed',
  near: '148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7',
  moonbeam: '000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d92',
  arbitrum: '0000000000000000000000000b2402144bb366a632d14b83f244d2e0e21bd39c',
  optimism: '0000000000000000000000001d68124e65fafc907325e3edbf8c4d84499daa8b',
  xpla: '8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c',
  injective: '00000000000000000000000045dbea4617971d93188eda21530bc6503d153313',
};

export const isTokenBridgeEmitter = (chain: ChainId | ChainName, emitter: string) =>
  TOKEN_BRIDGE_EMITTERS[coalesceChainName(chain)] === emitter;
