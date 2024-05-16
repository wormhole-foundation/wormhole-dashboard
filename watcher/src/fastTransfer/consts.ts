import { Network } from '@wormhole-foundation/sdk-base';

export type FastTransferContracts = 'MatchingEngine' | 'TokenRouter' | 'USDCMint';

// Will define more as we know what the mainnet addresses are
export type MatchingEngineProgramId = 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS';
export type TokenRouterProgramId = 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md';
export type USDCMintAddress = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Define the structure for the contract addresses
export interface ContractAddresses {
  MatchingEngine: MatchingEngineProgramId;
  TokenRouter: TokenRouterProgramId;
  USDCMint: USDCMintAddress;
}

// Define the structure for the environments
export type FastTransferContractAddresses = { [key in Network]?: ContractAddresses };

export const FAST_TRANSFER_CONTRACTS: FastTransferContractAddresses = {
  Mainnet: {
    // TODO: change this to actual mainnet address when they are deployed
    MatchingEngine: 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS',
    TokenRouter: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
    USDCMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  Testnet: {
    MatchingEngine: 'mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS',
    TokenRouter: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
    USDCMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
};
