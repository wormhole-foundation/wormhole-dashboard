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
    },
    Base: {
      TokenRouter: '0x70287c79ee41C5D1df8259Cd68Ba0890cd389c47',
      CircleBridge: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
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
  },
};

// Separate testnet and mainnet chains
export type FTEVMMainnetChain = 'Arbitrum' | 'Base';
export type FTEVMTestnetChain = 'ArbitrumSepolia';
export type FTEVMChain = FTEVMMainnetChain | FTEVMTestnetChain;

export const FTEVMMainnetChains: FTEVMMainnetChain[] = ['Arbitrum', 'Base'];
export const FTEVMTestnetChains: FTEVMTestnetChain[] = ['ArbitrumSepolia'];

export const isFTEVMChain = (chain: Chain, network: Network): chain is FTEVMChain => {
  if (network === 'Mainnet') {
    return FTEVMMainnetChains.includes(chain as FTEVMMainnetChain);
  } else if (network === 'Testnet') {
    return FTEVMTestnetChains.includes(chain as FTEVMTestnetChain);
  }
  return false;
};
