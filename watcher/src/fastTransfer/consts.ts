import { Network } from '@wormhole-foundation/sdk-base';

export type FastTransferContracts = 'MatchingEngine' | 'TokenRouter' | 'USDCMint';

// Will define more as we know what the mainnet addresses are
export type MatchingEngineProgramId = 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS';
export type TokenRouterProgramId = 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md';
export type USDCMintAddress = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export interface SolanaContractAddresses {
  MatchingEngine: MatchingEngineProgramId;
  TokenRouter: TokenRouterProgramId;
  USDCMint: USDCMintAddress;
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
    Solana?: SolanaContractAddresses;
    ArbitrumSepolia?: EthereumContractAddresses;
    Ethereum?: EthereumContractAddresses;
  };
};

// Will add more chains as needed
export const FAST_TRANSFER_CONTRACTS: FastTransferContractAddresses = {
  Mainnet: {},
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

// Will add more chains as needed
export type FTChains = 'ArbitrumSepolia';
