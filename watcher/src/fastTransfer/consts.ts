import { Chain, Network } from '@wormhole-foundation/sdk-base';

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
}

export type ContractAddresses = SolanaContractAddresses | EthereumContractAddresses;

export type FastTransferContractAddresses = {
  [key in Network]?: {
    Solana?: SolanaContractAddresses;
    ArbitrumSepolia?: EthereumContractAddresses;
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

// errorMap from IDL to quickly lookup error code
export const matchingEngineErrorMap: { [key: number]: string } = {
  6002: 'OwnerOnly',
  6004: 'OwnerOrAssistantOnly',
  6016: 'U64Overflow',
  6018: 'U32Overflow',
  6032: 'SameEndpoint',
  6034: 'InvalidEndpoint',
  6048: 'InvalidVaa',
  6066: 'InvalidDeposit',
  6068: 'InvalidDepositMessage',
  6070: 'InvalidPayloadId',
  6072: 'InvalidDepositPayloadId',
  6074: 'NotFastMarketOrder',
  6076: 'VaaMismatch',
  6078: 'RedeemerMessageTooLarge',
  6096: 'InvalidSourceRouter',
  6098: 'InvalidTargetRouter',
  6100: 'EndpointDisabled',
  6102: 'InvalidCctpEndpoint',
  6128: 'Paused',
  6256: 'AssistantZeroPubkey',
  6257: 'FeeRecipientZeroPubkey',
  6258: 'ImmutableProgram',
  6260: 'ZeroDuration',
  6262: 'ZeroGracePeriod',
  6263: 'ZeroPenaltyPeriod',
  6264: 'UserPenaltyRewardBpsTooLarge',
  6266: 'InitialPenaltyBpsTooLarge',
  6268: 'MinOfferDeltaBpsTooLarge',
  6270: 'ZeroSecurityDepositBase',
  6271: 'SecurityDepositBpsTooLarge',
  6514: 'InvalidNewOwner',
  6516: 'AlreadyOwner',
  6518: 'NoTransferOwnershipRequest',
  6520: 'NotPendingOwner',
  6524: 'InvalidChain',
  6576: 'ChainNotAllowed',
  6578: 'InvalidMintRecipient',
  6768: 'ProposalAlreadyEnacted',
  6770: 'ProposalDelayNotExpired',
  6772: 'InvalidProposal',
  6832: 'AuctionConfigMismatch',
  7024: 'FastMarketOrderExpired',
  7026: 'OfferPriceTooHigh',
  7032: 'AuctionNotActive',
  7034: 'AuctionPeriodExpired',
  7036: 'AuctionPeriodNotExpired',
  7044: 'ExecutorTokenMismatch',
  7050: 'AuctionNotCompleted',
  7054: 'CarpingNotAllowed',
  7056: 'AuctionNotSettled',
  7058: 'ExecutorNotPreparedBy',
  7060: 'InvalidOfferToken',
  7062: 'FastFillTooLarge',
  7064: 'AuctionExists',
  7065: 'AccountNotAuction',
  7066: 'BestOfferTokenMismatch',
  7068: 'BestOfferTokenRequired',
  7070: 'PreparedByMismatch',
  7071: 'PreparedOrderResponseNotRequired',
  7072: 'AuctionConfigNotRequired',
  7073: 'BestOfferTokenNotRequired',
  7076: 'FastFillAlreadyRedeemed',
  7077: 'FastFillNotRedeemed',
  7080: 'ReservedSequenceMismatch',
  7280: 'CannotCloseAuctionYet',
  7282: 'AuctionHistoryNotFull',
  7284: 'AuctionHistoryFull',
};
