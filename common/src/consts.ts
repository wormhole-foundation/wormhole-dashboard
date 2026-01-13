import {
  Chain,
  ChainId,
  Network,
  chainToChainId,
  toChain,
  toChainId,
} from '@wormhole-foundation/sdk-base';

export type Mode = 'vaa' | 'ntt' | 'ft';

// This is defined here in an effort to keep the number and text in sync.
// The default value is not exported because the getMissThreshold() function should be used to get the value.
const MISS_THRESHOLD_IN_MINS_DEFAULT = 40;
export const MISS_THRESHOLD_LABEL = '40 minutes';

export const MAX_VAA_DECIMALS = 8;
export const VAA_VERSION = 1;

type NetworkChainBlockMapping = { [key in Network]: { [key in Chain]?: string } };

export const INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN: NetworkChainBlockMapping = {
  ['Mainnet']: {
    Algorand: '22931277',
    Aptos: '0', // block is 1094390 but AptosWatcher uses sequence number instead
    Arbitrum: '18128584',
    Avalanche: '8237163',
    Base: '1422314',
    Berachain: '968947', // https://berascan.com/tx/0x5a425c6fee87ccc44ef87c1d9cb9c7d1deda4b8596b67c003726e68a2f06e0a4
    Bsc: '9745450',
    Celo: '12947144',
    CreditCoin: '2205137', // Block of contract creation, https://creditcoin.blockscout.com/tx/0x1bee86a5b5299a61c4337a8963b31b8e5bc02b383fb129fe2bd209f61675a805
    Ethereum: '12959638',
    Fogo: '32335413', // Block of contract creation https://explorer.fogo.io/address/wormQuCVWSSmPdjVmEzAWxAXViVyTSWnLyhff5hVYGS?cluster=custom&customUrl=https%3A%2F%2Fmainnet.fogo.io
    HyperEVM: '3915634', // Block of contract creation, https://purrsec.com/tx/0xd345fd5094fe1c901b9cd43cf68bcdc9829f4a5596853838800b47552e2e19dc
    Ink: '7711131', // Block of contract creation, https://explorer.inkonchain.com/tx/0x2576b03a4c0de8566778cb3149a0dbc1c8f8dfcf5d87c9f5f96038c4b15e3797
    Injective: '20908376',
    Klaytn: '90563824',
    Linea: '13399665',
    Mantle: '64176265',
    MegaETH: '1390753', // Block of contract creation https://megaeth-testnet-v3.blockscout.com/tx/0xf6bab2f9b4044d44c5ceb0d0d80ef7352166b0be39954baed61ca950c73ebb99
    Mezo: '232424', // Block of contract creation, https://explorer.mezo.org/tx/0x7ed15d6a210738bfd3b7606f6309bebb5533b67a9777626376864d893bbe51b5
    // Moca: '' Block of contract creation once deployed
    Monad: '24707720', // Block of contract creation
    Moonbeam: '1486591',
    Near: '72767136',
    Optimism: '69401779',
    Plume: '9146992', // Block of contract creation, https://explorer.plume.org/tx/0x11251febf0fd6b2b247422fe451cda3fad1da42165d32db44a090a262095278b
    Polygon: '20629146',
    Scroll: '4955534',
    Sei: '238594',
    Solana: '94396403', // https://explorer.solana.com/tx/2L8rQY94W2d44sycRkhHA1PyXdh5z6ND541ftDDk1dgBcv6RLR9a3zUgTJispPmXjkmqdqd5EDytXcnP5PC2AmEJ
    Sui: '1485552', // https://explorer.sui.io/txblock/671SoTvVUvBZQWKXeameDvAwzHQvnr8Nj7dR9MUwm3CV?network=https%3A%2F%2Frpc.mainnet.sui.io
    Unichain: '8115676', // https://unichain.blockscout.com/tx/0x4d65e33abc388c2d92c71ea01374af935a6615d0e555a7abbdef6c44e04613ba
    Worldchain: '5805110', // https://worldscan.org/tx/0x568eb14596296bda3022527cf0e915bfec073613b27c495e695fb9e08652f6fc
    Wormchain: '4510119', // https://bigdipper.live/wormhole/transactions/4D861F1BE86325D227FA006CA2745BBC6748AF5B5E0811DE536D02792928472A
    XRPLEVM: '1590372', // Block of contract creation, https://explorer.xrplevm.org/tx/0x0421c24113a47514a8f0c5511322702734b06ada4f43ca0a197a829ef1bfb203
  },
  ['Testnet']: {
    Ethereum: '0',
    Bsc: '0',
    Polygon: '0',
    Avalanche: '0',
    Algorand: '0',
    Klaytn: '0',
    Celo: '0',
    Moonbeam: '0',
    Injective: '0',
    Arbitrum: '0',
    Optimism: '0',
    Aptos: '0',
    Near: '0',
    Solana: '0',
    Sui: '0',
    Scroll: '0',
    Mantle: '0',
    Base: '0',
    Sei: '0',
    Wormchain: '4495661',
    PolygonSepolia: '2379275',
    Berachain: '846481',
    Seievm: '142153268', // Block of contract creation
    Unichain: '254961', // Block of contract creation
    Worldchain: '4487948', // Block of contract creation
    Monad: '5776870', // Block of contract creation
    Ink: '1907965', // Block of contract creation
    HyperEVM: '13743181', // Block of contract creation
    Mezo: '3102383', // Block of contract creation
    Converge: '7564', // Block of contract creation
    Plume: '14026067', // Block of contract creation
    XRPLEVM: '2545210', // Block of contract creation, https://explorer.testnet.xrplevm.org/tx/0x9d083173bc92c4e3ba97369bd81734eedf99044ca9577e7ab4edefa177b12492
    CreditCoin: '3372887', // Block of contract creation, https://creditcoin-testnet.blockscout.com/tx/0x8dd5689209dfcfd739a4f0af97301b4556687021fd41a1bf761724b5fd78b420
    Fogo: '9840330', // Block of contract creation
    Moca: '5329055', // Block of contract creation, https://testnet-scan.mocachain.org/tx/0x7d39257dfad53e2985eb26fb5549207200f23692e13a64b0670538148197a5a7
    MegaETH: '4290012', // Block of contract creation https://megaeth-testnet-v2.blockscout.com/tx/0x4c0ac471338ea109b8b3cb66967984766aa83edbeb843b63b2e24ded1dce52b9
  },
  ['Devnet']: {},
};

export const INITIAL_NTT_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN: NetworkChainBlockMapping = {
  ['Mainnet']: {
    Solana: '260508723',
    Ethereum: '19583505',
    Arbitrum: '201652677',
    Optimism: '118840800',
    Base: '13245519',
  },
  ['Testnet']: {
    Solana: '285100152',
    Sepolia: '5472203',
    ArbitrumSepolia: '22501243',
    BaseSepolia: '7249669',
    OptimismSepolia: '9232548',
  },
  ['Devnet']: {},
};

export const INITIAL_FT_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN: NetworkChainBlockMapping = {
  ['Mainnet']: {
    Solana: '285350104',
    Arbitrum: '245882390',
    Avalanche: '55500000',
    Base: '18956026',
    Ethereum: '21630000',
    Optimism: '130500000',
    Polygon: '66500000',
  },
  ['Testnet']: {
    Solana: '302162456',
    ArbitrumSepolia: '49505590',
  },
  ['Devnet']: {},
};

export const INITIAL_DEPLOYMENT_BLOCK_BY_MODE: {
  [mode in Mode]: NetworkChainBlockMapping;
} = {
  vaa: INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  ntt: INITIAL_NTT_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  ft: INITIAL_FT_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
};

export function getMissThreshold(date: Date, chainish: number | string | Chain | ChainId): string {
  // We would like chainish to really be a ChainId.
  let missThresholdInMins: number;
  try {
    let chainId: ChainId;
    if (typeof chainish === 'string' && !Number.isNaN(Number(chainish))) {
      // e.g. Handle '1'
      chainId = toChainId(Number(chainish));
    } else {
      // At this point we either have a number, a non-number string, a Chain, or a ChainId
      chainId = toChainId(chainish);
    }
    missThresholdInMins = chainId === toChainId('Scroll') ? 120 : MISS_THRESHOLD_IN_MINS_DEFAULT;
  } catch (e) {
    // If we can't get the chainId, we'll use the default value.
    missThresholdInMins = MISS_THRESHOLD_IN_MINS_DEFAULT;
  }
  const missDate = new Date(date);
  missDate.setMinutes(missDate.getMinutes() - missThresholdInMins);
  return missDate.toISOString();
}

export const TOKEN_BRIDGE_EMITTERS: { [key in Chain]?: string } = {
  Solana: 'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
  Ethereum: '0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585',
  Bsc: '000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7',
  Polygon: '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde',
  Avalanche: '0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052',
  Algorand: '67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45',
  Aptos: '0000000000000000000000000000000000000000000000000000000000000001',
  Klaytn: '0000000000000000000000005b08ac39eaed75c0439fc750d9fe7e1f9dd0193f',
  Celo: '000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed',
  Near: '148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7',
  Moonbeam: '000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d92',
  Arbitrum: '0000000000000000000000000b2402144bb366a632d14b83f244d2e0e21bd39c',
  Optimism: '0000000000000000000000001d68124e65fafc907325e3edbf8c4d84499daa8b',
  Injective: '00000000000000000000000045dbea4617971d93188eda21530bc6503d153313',
  Sui: 'ccceeb29348f71bdd22ffef43a2a19c1f5b5e17c5cca5411529120182672ade5',
  Base: '0000000000000000000000008d2de8d2f73f1f4cab472ac9a881c9b123c79627',
  Scroll: '00000000000000000000000024850c6f61C438823F01B7A3BF2B89B72174Fa9d',
  Mantle: '00000000000000000000000024850c6f61C438823F01B7A3BF2B89B72174Fa9d',
  Xlayer: '0000000000000000000000005537857664B0f9eFe38C9f320F75fEf23234D904',
  Sei: '86c5fd957e2db8389553e1728f9c27964b22a8154091ccba54d75f4b10c61f5e',
  Wormchain: 'aeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924',
  XRPLEVM: '0000000000000000000000007d8eBc211C4221eA18E511E4f0fD50c5A539f275',
  Fogo: '289e998e357c96dbfd8490b853595e0d48639ede2d1aed4a819edcc00165904c',
};

export const isTokenBridgeEmitter = (chain: ChainId | Chain, emitter: string) => {
  try {
    return TOKEN_BRIDGE_EMITTERS[toChain(chain)]?.toLowerCase() === emitter.toLowerCase();
  } catch (e) {
    return false;
  }
};

export const NFT_BRIDGE_EMITTERS: { [key in Chain]?: string } = {
  Solana: '0def15a24423e1edd1a5ab16f557b9060303ddbab8c803d2ee48f4b78a1cfd6b',
  Ethereum: '0000000000000000000000006ffd7ede62328b3af38fcd61461bbfc52f5651fe',
  Bsc: '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde',
  Polygon: '00000000000000000000000090bbd86a6fe93d3bc3ed6335935447e75fab7fcf',
  Avalanche: '000000000000000000000000f7b6737ca9c4e08ae573f75a97b73d7a813f5de5',
  Klaytn: '0000000000000000000000003c3c561757baa0b78c5c025cdeaa4ee24c1dffef',
  Celo: '000000000000000000000000a6a377d75ca5c9052c9a77ed1e865cc25bd97bf3',
  Moonbeam: '000000000000000000000000453cfbe096c0f8d763e8c5f24b441097d577bde2',
  Arbitrum: '0000000000000000000000003dd14d553cfd986eac8e3bddf629d82073e188c8',
  Optimism: '000000000000000000000000fe8cd454b4a1ca468b57d79c0cc77ef5b6f64585',
  Aptos: '0000000000000000000000000000000000000000000000000000000000000005',
  Base: '000000000000000000000000da3adc6621b2677bef9ad26598e6939cf0d92f88',
};

export const isNFTBridgeEmitter = (chain: ChainId | Chain, emitter: string) => {
  try {
    return NFT_BRIDGE_EMITTERS[toChain(chain)]?.toLowerCase() === emitter.toLowerCase();
  } catch (e) {
    return false;
  }
};

export const CIRCLE_INTEGRATION_EMITTERS: { [key in Chain]?: string } = {
  Ethereum: '000000000000000000000000aada05bd399372f0b0463744c09113c137636f6a',
  Avalanche: '00000000000000000000000009fb06a271faff70a651047395aaeb6265265f13',
  Optimism: '0000000000000000000000002703483b1a5a7c577e8680de9df8be03c6f30e3c',
  Arbitrum: '0000000000000000000000002703483b1a5a7c577e8680de9df8be03c6f30e3c',
  Base: '00000000000000000000000003faBB06Fa052557143dC28eFCFc63FC12843f1D',
  Polygon: '0000000000000000000000000FF28217dCc90372345954563486528aa865cDd6',
};

export const isCircleIntegrationEmitter = (chain: ChainId | Chain, emitter: string) => {
  try {
    return CIRCLE_INTEGRATION_EMITTERS[toChain(chain)]?.toLowerCase() === emitter.toLowerCase();
  } catch (e) {
    return false;
  }
};

// https://developers.circle.com/stablecoins/docs/supported-domains
export const CIRCLE_DOMAIN_TO_CHAIN_ID: { [key: number]: ChainId } = {
  0: chainToChainId('Ethereum'),
  1: chainToChainId('Avalanche'),
  2: chainToChainId('Optimism'),
  3: chainToChainId('Arbitrum'),
  6: chainToChainId('Base'),
  7: chainToChainId('Polygon'),
};

export const ACCOUNTANT_CONTRACT_ADDRESS =
  'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465';
export const NTT_ACCOUNTANT_CONTRACT_ADDRESS_MAINNET =
  'wormhole1mc23vtzxh46e63vq22e8cnv23an06akvkqws04kghkrxrauzpgwq2hmwm7';
export const NTT_ACCOUNTANT_CONTRACT_ADDRESS_TESTNET =
  'wormhole169tvyx49zmjqhlv7mzwj8j2weprascc0jq3rdglw9pynldqx34nscvhc7k';

export const GUARDIAN_SET_4 = [
  {
    pubkey: '0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3',
    name: 'RockawayX',
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

export const STANDBY_GUARDIANS = [
  {
    pubkey: '0x68c16a92903c4c74ffddc730582ba53d967d3dac',
    name: 'Google Cloud',
  },
];

export type GuardianSetInfo = {
  timestamp: string;
  contract: string;
  guardianSetIndex: string;
  guardianSet: string;
};

export type GuardianSetInfoByChain = {
  [chain in Chain]?: GuardianSetInfo;
};

// TODO: this should probably be a table in the database
export const TVL_TOKEN_DENYLIST: { [key in ChainId]?: string[] } = {};

export const isTokenDenylisted = (chainId: ChainId, address: string): boolean => {
  return TVL_TOKEN_DENYLIST[chainId]?.includes(address.toLowerCase()) ?? false;
};
