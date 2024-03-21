import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BASE,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_OASIS,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_PYTHNET,
  CHAIN_ID_SEI,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_WORMCHAIN,
  CHAIN_ID_XPLA,
  ChainId,
  ChainName,
  coalesceChainName,
} from '@certusone/wormhole-sdk';

export type Environment = 'mainnet' | 'testnet' | 'devnet';
export type Network = {
  env: Environment;
  endpoint: string;
  name: string;
  logo: string;
  type: 'guardian' | 'cloudfunction';
};

export const INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN: {
  [key in Environment]: { [key in ChainName]?: string };
} = {
  ['mainnet']: {
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
    solana: '94396403', // https://explorer.solana.com/tx/2L8rQY94W2d44sycRkhHA1PyXdh5z6ND541ftDDk1dgBcv6RLR9a3zUgTJispPmXjkmqdqd5EDytXcnP5PC2AmEJ
    sui: '1485552', // https://explorer.sui.io/txblock/671SoTvVUvBZQWKXeameDvAwzHQvnr8Nj7dR9MUwm3CV?network=https%3A%2F%2Frpc.mainnet.sui.io
    base: '1422314',
    sei: '238594',
    wormchain: '4510119', // https://bigdipper.live/wormhole/transactions/4D861F1BE86325D227FA006CA2745BBC6748AF5B5E0811DE536D02792928472A  },
  },
  ['testnet']: {
    ethereum: '0',
    terra: '0',
    bsc: '0',
    polygon: '0',
    avalanche: '0',
    oasis: '0',
    algorand: '0',
    fantom: '0',
    karura: '0',
    acala: '0',
    klaytn: '0',
    celo: '0',
    moonbeam: '0',
    terra2: '0',
    injective: '0',
    arbitrum: '0',
    optimism: '0',
    aptos: '0',
    near: '0',
    xpla: '0',
    solana: '0',
    sui: '0',
    base: '0',
    sei: '0',
    wormchain: '0',
    polygon_sepolia: '2379275',
  },
  ['devnet']: {},
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
  sui: 'ccceeb29348f71bdd22ffef43a2a19c1f5b5e17c5cca5411529120182672ade5',
  base: '0000000000000000000000008d2de8d2f73f1f4cab472ac9a881c9b123c79627',
  sei: '86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e',
  wormchain: 'aeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924',
};

export const isTokenBridgeEmitter = (chain: ChainId | ChainName, emitter: string) =>
  TOKEN_BRIDGE_EMITTERS[coalesceChainName(chain)]?.toLowerCase() === emitter.toLowerCase();

export const NFT_BRIDGE_EMITTERS: { [key in ChainName]?: string } = {
  solana: '0def15a24423e1edd1a5ab16f557b9060303ddbab8c803d2ee48f4b78a1cfd6b',
  ethereum: '0000000000000000000000006ffd7ede62328b3af38fcd61461bbfc52f5651fe',
  bsc: '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde',
  polygon: '00000000000000000000000090bbd86a6fe93d3bc3ed6335935447e75fab7fcf',
  avalanche: '000000000000000000000000f7b6737ca9c4e08ae573f75a97b73d7a813f5de5',
  oasis: '00000000000000000000000004952d522ff217f40b5ef3cbf659eca7b952a6c1',
  aurora: '0000000000000000000000006dcc0484472523ed9cdc017f711bcbf909789284',
  fantom: '000000000000000000000000a9c7119abda80d4a4e0c06c8f4d8cf5893234535',
  karura: '000000000000000000000000b91e3638f82a1facb28690b37e3aae45d2c33808',
  acala: '000000000000000000000000b91e3638f82a1facb28690b37e3aae45d2c33808',
  klaytn: '0000000000000000000000003c3c561757baa0b78c5c025cdeaa4ee24c1dffef',
  celo: '000000000000000000000000a6a377d75ca5c9052c9a77ed1e865cc25bd97bf3',
  moonbeam: '000000000000000000000000453cfbe096c0f8d763e8c5f24b441097d577bde2',
  arbitrum: '0000000000000000000000003dd14d553cfd986eac8e3bddf629d82073e188c8',
  optimism: '000000000000000000000000fe8cd454b4a1ca468b57d79c0cc77ef5b6f64585',
  aptos: '0000000000000000000000000000000000000000000000000000000000000005',
  base: '000000000000000000000000da3adc6621b2677bef9ad26598e6939cf0d92f88',
};

export const isNFTBridgeEmitter = (chain: ChainId | ChainName, emitter: string) =>
  NFT_BRIDGE_EMITTERS[coalesceChainName(chain)]?.toLowerCase() === emitter.toLowerCase();

export const CIRCLE_INTEGRATION_EMITTERS: { [key in ChainName]?: string } = {
  ethereum: '000000000000000000000000aada05bd399372f0b0463744c09113c137636f6a',
  avalanche: '00000000000000000000000009fb06a271faff70a651047395aaeb6265265f13',
  optimism: '0000000000000000000000002703483b1a5a7c577e8680de9df8be03c6f30e3c',
  arbitrum: '0000000000000000000000002703483b1a5a7c577e8680de9df8be03c6f30e3c',
  base: '00000000000000000000000003faBB06Fa052557143dC28eFCFc63FC12843f1D',
  polygon: '0000000000000000000000000FF28217dCc90372345954563486528aa865cDd6',
};

export const isCircleIntegrationEmitter = (chain: ChainId | ChainName, emitter: string) =>
  CIRCLE_INTEGRATION_EMITTERS[coalesceChainName(chain)]?.toLowerCase() === emitter.toLowerCase();

// https://developers.circle.com/stablecoins/docs/supported-domains
export const CIRCLE_DOMAIN_TO_CHAIN_ID: { [key: number]: ChainId } = {
  0: CHAIN_ID_ETH,
  1: CHAIN_ID_AVAX,
  2: CHAIN_ID_OPTIMISM,
  3: CHAIN_ID_ARBITRUM,
  6: CHAIN_ID_BASE,
  7: CHAIN_ID_POLYGON,
};
export type CHAIN_INFO = {
  name: string;
  evm: boolean;
  chainId: ChainId;
  endpointUrl: any;
  explorerStem: string;
};

export const CHAIN_INFO_MAP: { [key in Environment]: { [key: string]: CHAIN_INFO } } = {
  ['mainnet']: {
    1: {
      name: 'solana',
      evm: false,
      chainId: CHAIN_ID_SOLANA,
      endpointUrl: process.env.REACT_APP_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      explorerStem: `https://solana.fm`,
    },
    2: {
      name: 'eth',
      evm: true,
      chainId: CHAIN_ID_ETH,
      endpointUrl: process.env.REACT_APP_ETH_RPC || 'https://rpc.ankr.com/eth',
      explorerStem: `https://etherscan.io`,
    },
    3: {
      name: 'terra',
      evm: false,
      chainId: CHAIN_ID_TERRA,
      endpointUrl: '',
      explorerStem: `https://finder.terra.money/classic`,
    },
    4: {
      name: 'bsc',
      evm: true,
      chainId: CHAIN_ID_BSC,
      endpointUrl: process.env.REACT_APP_BSC_RPC || 'https://bsc-dataseed2.defibit.io',
      explorerStem: `https://bscscan.com`,
    },
    5: {
      name: 'polygon',
      evm: true,
      chainId: CHAIN_ID_POLYGON,
      endpointUrl: process.env.REACT_APP_POLYGON_RPC || 'https://polygon-rpc.com',
      explorerStem: `https://polygonscan.com`,
    },
    6: {
      name: 'avalanche',
      evm: true,
      chainId: CHAIN_ID_AVAX,
      endpointUrl: process.env.REACT_APP_AVAX_RPC || 'https://api.avax.network/ext/bc/C/rpc',
      explorerStem: `https://snowtrace.io`,
    },
    7: {
      name: 'oasis',
      evm: true,
      chainId: CHAIN_ID_OASIS,
      endpointUrl: 'https://emerald.oasis.dev',
      explorerStem: `https://explorer.emerald.oasis.dev`,
    },
    8: {
      name: 'algorand',
      evm: false,
      chainId: CHAIN_ID_ALGORAND,
      endpointUrl: 'https://node.algoexplorerapi.io',
      explorerStem: `https://algoexplorer.io`,
    },
    9: {
      name: 'aurora',
      evm: true,
      chainId: CHAIN_ID_AURORA,
      endpointUrl: 'https://mainnet.aurora.dev',
      explorerStem: `https://aurorascan.dev`,
    },
    10: {
      name: 'fantom',
      evm: true,
      chainId: CHAIN_ID_FANTOM,
      endpointUrl: 'https://rpc.ftm.tools',
      explorerStem: `https://ftmscan.com`,
    },
    11: {
      name: 'karura',
      evm: true,
      chainId: CHAIN_ID_KARURA,
      endpointUrl: 'https://eth-rpc-karura.aca-api.network',
      explorerStem: `https://blockscout.karura.network`,
    },
    12: {
      name: 'acala',
      evm: true,
      chainId: CHAIN_ID_ACALA,
      endpointUrl: 'https://eth-rpc-acala.aca-api.network',
      explorerStem: `https://blockscout.acala.network`,
    },
    13: {
      name: 'klaytn',
      evm: true,
      chainId: CHAIN_ID_KLAYTN,
      endpointUrl: 'https://klaytn-mainnet-rpc.allthatnode.com:8551',
      explorerStem: `https://scope.klaytn.com`,
    },
    14: {
      name: 'celo',
      evm: true,
      chainId: CHAIN_ID_CELO,
      endpointUrl: 'https://forno.celo.org',
      explorerStem: `https://explorer.celo.org`,
    },
    15: {
      name: 'near',
      evm: false,
      chainId: CHAIN_ID_NEAR,
      endpointUrl: '',
      explorerStem: `https://explorer.near.org`,
    },
    16: {
      name: 'moonbeam',
      evm: true,
      chainId: CHAIN_ID_MOONBEAM,
      endpointUrl: 'https://rpc.ankr.com/moonbeam',
      explorerStem: `https://moonscan.io`,
    },
    18: {
      name: 'terra2',
      evm: false,
      chainId: CHAIN_ID_TERRA2,
      endpointUrl: '',
      explorerStem: `https://finder.terra.money/mainnet`,
    },
    19: {
      name: 'injective',
      evm: false,
      chainId: CHAIN_ID_INJECTIVE,
      endpointUrl: '',
      explorerStem: `https://explorer.injective.network`,
    },
    21: {
      name: 'sui',
      evm: false,
      chainId: CHAIN_ID_SUI,
      endpointUrl: 'https://rpc.mainnet.sui.io',
      explorerStem: `https://explorer.sui.io`,
    },
    22: {
      name: 'aptos',
      evm: false,
      chainId: CHAIN_ID_APTOS,
      endpointUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
      explorerStem: `https://explorer.aptoslabs.com`,
    },
    23: {
      name: 'arbitrum',
      evm: true,
      chainId: CHAIN_ID_ARBITRUM,
      endpointUrl: 'https://arb1.arbitrum.io/rpc',
      explorerStem: `https://arbiscan.io`,
    },
    24: {
      name: 'optimism',
      evm: true,
      chainId: CHAIN_ID_OPTIMISM,
      endpointUrl: 'https://rpc.ankr.com/optimism',
      explorerStem: `https://optimistic.etherscan.io`,
    },
    26: {
      name: 'pythnet',
      evm: false,
      chainId: CHAIN_ID_PYTHNET,
      endpointUrl: '',
      explorerStem: '',
    },
    28: {
      name: 'xpla',
      evm: false,
      chainId: CHAIN_ID_XPLA,
      endpointUrl: 'https://dimension-lcd.xpla.dev',
      explorerStem: `https://explorer.xpla.io`,
    },
    30: {
      name: 'base',
      evm: true,
      chainId: CHAIN_ID_BASE,
      endpointUrl: 'https://rpc.ankr.com/base',
      explorerStem: `https://basescan.org`,
    },
    32: {
      name: 'sei',
      evm: false,
      chainId: CHAIN_ID_SEI,
      endpointUrl: '',
      explorerStem: '',
    },
    3104: {
      name: 'wormchain',
      evm: false,
      chainId: CHAIN_ID_WORMCHAIN,
      endpointUrl: '',
      explorerStem: '',
    },
  },
  ['testnet']: {
    // The chains not, currently, supported on testnet are commented out.
    1: {
      name: 'solana',
      evm: false,
      chainId: CHAIN_ID_SOLANA,
      endpointUrl: 'https://api.testnet.solana.com',
      explorerStem: 'https://explorer.solana.com/?cluster=testnet',
    },
    2: {
      name: 'eth',
      evm: true,
      chainId: CHAIN_ID_ETH,
      endpointUrl: 'https://ethereum-sepolia.publicnode.com',
      explorerStem: 'https://sepolia.etherscan.io',
    },
    // 3: {
    //   name: 'terra',
    //   evm: false,
    //   chainId: CHAIN_ID_TERRA,
    //   endpointUrl: '',
    //   explorerStem: `https://finder.terra.money/classic`,
    // },
    4: {
      name: 'bsc',
      evm: true,
      chainId: CHAIN_ID_BSC,
      endpointUrl: 'https://bsc-testnet.publicnode.com',
      explorerStem: 'https://testnet.bscscan.com',
    },
    5: {
      name: 'polygon',
      evm: true,
      chainId: CHAIN_ID_POLYGON,
      endpointUrl: 'https://rpc.ankr.com/polygon_mumbai',
      explorerStem: 'https://mumbai.polygonscan.com',
    },
    6: {
      name: 'avalanche',
      evm: true,
      chainId: CHAIN_ID_AVAX,
      endpointUrl: 'https://rpc.ankr.com/avalanche_fuji',
      explorerStem: 'https://testnet.snowtrace.io',
    },
    7: {
      name: 'oasis',
      evm: true,
      chainId: CHAIN_ID_OASIS,
      endpointUrl: 'https://testnet.emerald.oasis.dev',
      explorerStem: 'https://testnet.oasisscan.com',
    },
    8: {
      name: 'algorand',
      evm: false,
      chainId: CHAIN_ID_ALGORAND,
      endpointUrl: 'https://testnet-api.algonode.cloud',
      explorerStem: 'https://testnet.algoexplorer.io',
    },
    10: {
      name: 'fantom',
      evm: true,
      chainId: CHAIN_ID_FANTOM,
      endpointUrl: 'https://fantom-testnet.publicnode.com',
      explorerStem: 'https://testnet.ftmscan.com',
    },
    // 11: {
    //   name: 'karura',
    //   evm: true,
    //   chainId: CHAIN_ID_KARURA,
    //   endpointUrl: '',
    //   explorerStem: '',
    // },
    12: {
      name: 'acala',
      evm: true,
      chainId: CHAIN_ID_ACALA,
      endpointUrl: 'https://eth-rpc-acala-testnet.aca-staging.network',
      explorerStem: 'https://blockscout.mandala.aca-staging.network',
    },
    13: {
      name: 'klaytn',
      evm: true,
      chainId: CHAIN_ID_KLAYTN,
      endpointUrl: 'https://rpc.ankr.com/klaytn_testnet',
      explorerStem: 'https://baobab.klaytnscope.com',
    },
    14: {
      name: 'celo',
      evm: true,
      chainId: CHAIN_ID_CELO,
      endpointUrl: 'https://alfajores-forno.celo-testnet.org',
      explorerStem: 'https://alfajores.celoscan.io',
    },
    // 15: {
    //   name: 'near',
    //   evm: false,
    //   chainId: CHAIN_ID_NEAR,
    //   endpointUrl: '',
    //   explorerStem: `https://explorer.near.org`,
    // },
    16: {
      name: 'moonbeam',
      evm: true,
      chainId: CHAIN_ID_MOONBEAM,
      endpointUrl: 'https://rpc.api.moonbase.moonbeam.network',
      explorerStem: 'https://moonbase.moonscan.io',
    },
    // 18: {
    //   name: 'terra2',
    //   evm: false,
    //   chainId: CHAIN_ID_TERRA2,
    //   endpointUrl: '',
    //   explorerStem: `https://finder.terra.money/mainnet`,
    // },
    // 19: {
    //   name: 'injective',
    //   evm: false,
    //   chainId: CHAIN_ID_INJECTIVE,
    //   endpointUrl: '',
    //   explorerStem: `https://explorer.injective.network`,
    // },
    21: {
      name: 'sui',
      evm: false,
      chainId: CHAIN_ID_SUI,
      endpointUrl: 'https://rpc.ankr.com/sui_testnet',
      explorerStem: 'https://suiexplorer.com/?network=testnet',
    },
    22: {
      name: 'aptos',
      evm: false,
      chainId: CHAIN_ID_APTOS,
      endpointUrl: 'https://fullnode.testnet.aptoslabs.com',
      explorerStem: 'https://explorer.aptoslabs.com/?network=testnet',
    },
    23: {
      name: 'arbitrum',
      evm: true,
      chainId: CHAIN_ID_ARBITRUM,
      endpointUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
      explorerStem: 'https://sepolia.arbiscan.io',
    },
    24: {
      name: 'optimism',
      evm: true,
      chainId: CHAIN_ID_OPTIMISM,
      endpointUrl: 'https://rpc.ankr.com/optimism_sepolia',
      explorerStem: 'https://sepolia-optimism.etherscan.io',
    },
    // 26: {
    //   name: 'pythnet',
    //   evm: false,
    //   chainId: CHAIN_ID_PYTHNET,
    //   endpointUrl: '',
    //   explorerStem: '',
    // },
    28: {
      name: 'xpla',
      evm: false,
      chainId: CHAIN_ID_XPLA,
      endpointUrl: 'https://cube-lcd.xpla.dev',
      explorerStem: 'https://explorer.xpla.io/testnet',
    },
    30: {
      name: 'base',
      evm: true,
      chainId: CHAIN_ID_BASE,
      endpointUrl: 'https://goerli.base.org',
      explorerStem: 'https://goerli.basescan.org',
    },
    32: {
      name: 'sei',
      evm: false,
      chainId: CHAIN_ID_SEI,
      endpointUrl: 'https://sei-testnet-rpc.polkachu.com',
      explorerStem: 'https://www.seiscan.app/atlantic-2',
    },
    // 3104: {
    //   name: 'wormchain',
    //   evm: false,
    //   chainId: CHAIN_ID_WORMCHAIN,
    //   endpointUrl: '',
    //   explorerStem: '',
    // },
  },
  ['devnet']: {},
};

export const JUMP_GUARDIAN_ADDRESS = '58cc3ae5c097b213ce3c81979e1b9f9570746aa5';
export const ACCOUNTANT_CONTRACT_ADDRESS =
  'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465';

export const GUARDIAN_SET_3 = [
  {
    pubkey: '0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5',
    name: 'Jump Crypto',
  },
  {
    pubkey: '0xfF6CB952589BDE862c25Ef4392132fb9D4A42157',
    name: 'Staked',
  },
  {
    pubkey: '0x114De8460193bdf3A2fCf81f86a09765F4762fD1',
    name: 'Figment',
  },
  {
    pubkey: '0x107A0086b32d7A0977926A205131d8731D39cbEB',
    name: 'ChainodeTech',
  },
  {
    pubkey: '0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2',
    name: 'Inotel',
  },
  {
    pubkey: '0x11b39756C042441BE6D8650b69b54EbE715E2343',
    name: 'HashQuark',
  },
  {
    pubkey: '0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd',
    name: 'Chainlayer',
  },
  {
    pubkey: '0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20',
    name: 'xLabs',
  },
  {
    pubkey: '0x74a3bf913953D695260D88BC1aA25A4eeE363ef0',
    name: 'Forbole',
  },
  {
    pubkey: '0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e',
    name: 'Staking Fund',
  },
  {
    pubkey: '0xAF45Ced136b9D9e24903464AE889F5C8a723FC14',
    name: 'MoonletWallet',
  },
  {
    pubkey: '0xf93124b7c738843CBB89E864c862c38cddCccF95',
    name: 'P2P Validator',
  },
  {
    pubkey: '0xD2CC37A4dc036a8D232b48f62cDD4731412f4890',
    name: '01Node',
  },
  {
    pubkey: '0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811',
    name: 'MCF',
  },
  {
    pubkey: '0x71AA1BE1D36CaFE3867910F99C09e347899C19C3',
    name: 'Everstake',
  },
  {
    pubkey: '0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf',
    name: 'Chorus One',
  },
  {
    pubkey: '0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8',
    name: 'Syncnode',
  },
  {
    pubkey: '0x5E1487F35515d02A92753504a8D75471b9f49EdB',
    name: 'Triton',
  },
  {
    pubkey: '0x6FbEBc898F403E4773E95feB15E80C9A99c8348d',
    name: 'Staking Facilities',
  },
];
