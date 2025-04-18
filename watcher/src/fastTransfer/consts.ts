import { Chain, Network } from '@wormhole-foundation/sdk-base';

export type FastTransferContracts = 'MatchingEngine' | 'TokenRouter' | 'USDCMint';

export type MatchingEngineProgramId =
  | 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS'
  | 'HtkeCDdYY4i9ncAxXKjYTx8Uu3WM8JbtiLRYjtHwaVXb';
export type TokenRouterProgramId =
  | 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md'
  | '28topqjtJzMnPaGFmmZk68tzGmj9W9aMntaEK3QkgtRe';
export type USDCMintAddress =
  | '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
  | 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export type SwapLayerProgramId =
  | 'SwapLayer1111111111111111111111111111111111'
  | '9Zv8ajzFjacRoYCgCPus4hq3pYjpNa9KkTFQ1sHa1h3d';

export interface SolanaContractAddresses {
  MatchingEngine: MatchingEngineProgramId;
  TokenRouter: TokenRouterProgramId;
  USDCMint: USDCMintAddress;
  // Devnet has no swap layer as they need the mainnet quotes from Uniswap
  SwapLayer?: SwapLayerProgramId;
}

export interface EthereumContractAddresses {
  TokenRouter: string;
  CircleBridge?: string;
  // Devnet has no swap layer as they need the mainnet quotes from Uniswap
  SwapLayer?: string;
}

export type ContractAddresses = SolanaContractAddresses | EthereumContractAddresses;

export type FastTransferContractAddresses = {
  [key in Network]?: {
    // For each chain, use SolanaContractAddresses if it's Solana, otherwise use EthereumContractAddresses
    [chain in Chain]?: chain extends 'Solana' ? SolanaContractAddresses : EthereumContractAddresses;
  };
};

// Will add more chains as needed
export const FAST_TRANSFER_CONTRACTS: FastTransferContractAddresses = {
  Mainnet: {
    Solana: {
      MatchingEngine: 'HtkeCDdYY4i9ncAxXKjYTx8Uu3WM8JbtiLRYjtHwaVXb',
      TokenRouter: '28topqjtJzMnPaGFmmZk68tzGmj9W9aMntaEK3QkgtRe',
      USDCMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      // TODO: uncomment this when SwapLayer is deployed on Solana Mainnet
      // SwapLayer: '9Zv8ajzFjacRoYCgCPus4hq3pYjpNa9KkTFQ1sHa1h3d',
    },
    Arbitrum: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
      SwapLayer: '0x4dE319b7492E791cDe47FDf12c922cF568441C43',
    },
    Avalanche: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x6b25532e1060ce10cc3b0a99e5683b91bfde6982',
      SwapLayer: '',
    },
    Base: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
      SwapLayer: '0x2Ab7BeEF955826054d03419Ee2122445Ca677eb2',
    },
    Ethereum: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
      SwapLayer: '',
    },
    Optimism: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
      SwapLayer: '',
    },
    Polygon: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
      SwapLayer: '',
    },
  },
  Testnet: {
    Solana: {
      MatchingEngine: 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS',
      TokenRouter: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
      USDCMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    },
    ArbitrumSepolia: {
      TokenRouter: '0xe0418C44F06B0b0D7D1706E01706316DBB0B210E',
      CircleBridge: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    },
    OptimismSepolia: {
      TokenRouter: '0x6BAa7397c18abe6221b4f6C3Ac91C88a9faE00D8',
      CircleBridge: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    },
  },
};

// Separate testnet and mainnet chains
export type FTEVMMainnetChain = 'Arbitrum' | 'Base' | 'Ethereum' | 'Optimism' | 'Polygon';
export type FTEVMTestnetChain = 'ArbitrumSepolia' | 'OptimismSepolia';
export type FTEVMChain = FTEVMMainnetChain | FTEVMTestnetChain;

export const FTEVMMainnetChains: FTEVMMainnetChain[] = [
  'Arbitrum',
  'Base',
  'Ethereum',
  'Optimism',
  'Polygon',
];
export const FTEVMTestnetChains: FTEVMTestnetChain[] = ['ArbitrumSepolia', 'OptimismSepolia'];

export const isFTEVMChain = (chain: Chain, network: Network): chain is FTEVMChain => {
  if (network === 'Mainnet') {
    return FTEVMMainnetChains.includes(chain as FTEVMMainnetChain);
  } else if (network === 'Testnet') {
    return FTEVMTestnetChains.includes(chain as FTEVMTestnetChain);
  }
  return false;
};
