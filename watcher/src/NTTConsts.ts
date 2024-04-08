import { keccak256 } from '@wormhole-foundation/sdk-definitions';
import { NativeTokenTransfer, NttManagerMessage } from './watchers/NTTPayloads';
import { Chain, Network } from '@wormhole-foundation/sdk-base';

//
// The following are from IRateLimiterEvents.sol
//

/// @notice Emitted when an inbound transfer is queued
/// @dev Topic0
///      0x7f63c9251d82a933210c2b6d0b0f116252c3c116788120e64e8e8215df6f3162.
/// @param digest The digest of the message.
/// event InboundTransferQueued(bytes32 digest);
export const InboundTransferQueuedTopic =
  '0x7f63c9251d82a933210c2b6d0b0f116252c3c116788120e64e8e8215df6f3162';

/// @notice Emitted when an outbound transfer is queued.
/// @dev Topic0
///      0x69add1952a6a6b9cb86f04d05f0cb605cbb469a50ae916139d34495a9991481f.
/// @param queueSequence The location of the transfer in the queue.
/// event OutboundTransferQueued(uint64 queueSequence);
export const OutboundTransferQueuedTopic =
  '0x69add1952a6a6b9cb86f04d05f0cb605cbb469a50ae916139d34495a9991481f';

/// @notice Emitted when an outbound transfer is rate limited.
/// @dev Topic0
///      0xf33512b84e24a49905c26c6991942fc5a9652411769fc1e448f967cdb049f08a.
/// @param sender The initial sender of the transfer.
/// @param amount The amount to be transferred.
/// @param currentCapacity The capacity left for transfers within the 24-hour window.:w
/// OutboundTransferRateLimited(address,uint64,uint256,uint256)
export const OutboundTransferRateLimitedTopic =
  '0xf33512b84e24a49905c26c6991942fc5a9652411769fc1e448f967cdb049f08a';

//
// The following are from INttManagerEvents.sol
//

/// @notice Emitted when a message is sent from the nttManager.
/// @dev Topic0
///      0x9cc8ade41ef46b98ba8bcad8c6bfa643934e6b84d3ce066cd38b5f0813bb2ae5.
/// @param recipient The recipient of the message.
/// @param refundAddress The address on the destination chain to which the
///                      refund of unused gas will be paid
/// @param amount The amount transferred.
/// @param fee The amount of ether sent along with the tx to cover the delivery fee.
/// @param recipientChain The chain ID of the recipient.
/// @param msgSequence The unique sequence ID of the message.
export const TransferSentTopic =
  '0xe54e51e42099622516fa3b48e9733581c9dbdcb771cafb093f745a0532a35982';

/// @notice Emitted when the peer contract is updated.
/// @dev Topic0
///      0x1456404e7f41f35c3daac941bb50bad417a66275c3040061b4287d787719599d.
/// @param chainId_ The chain ID of the peer contract.
/// @param oldPeerContract The old peer contract address.
/// @param oldPeerDecimals The old peer contract decimals.
/// @param peerContract The new peer contract address.
/// @param peerDecimals The new peer contract decimals.
export const PeerUpdatedTopic =
  '0x1456404e7f41f35c3daac941bb50bad417a66275c3040061b4287d787719599d';

/// @notice Emitted when a message has been attested to.
/// @dev Topic0
///      0x35a2101eaac94b493e0dfca061f9a7f087913fde8678e7cde0aca9897edba0e5.
/// @param digest The digest of the message.
/// @param transceiver The address of the transceiver.
/// @param index The index of the transceiver in the bitmap.
/// event MessageAttestedTo(bytes32 digest, address transceiver, uint8 index);
export const MessageAttestedToTopic =
  '0x35a2101eaac94b493e0dfca061f9a7f087913fde8678e7cde0aca9897edba0e5';

/// @notice Emmitted when the threshold required transceivers is changed.
/// @dev Topic0
///      0x2a855b929b9a53c6fb5b5ed248b27e502b709c088e036a5aa17620c8fc5085a9.
/// @param oldThreshold The old threshold.
/// @param threshold The new threshold.
/// event ThresholdChanged(uint8 oldThreshold, uint8 threshold);
export const ThresholdChangedTopic =
  '0x2a855b929b9a53c6fb5b5ed248b27e502b709c088e036a5aa17620c8fc5085a9';

/// @notice Emitted when an transceiver is removed from the nttManager.
/// @dev Topic0
///      0xf05962b5774c658e85ed80c91a75af9d66d2af2253dda480f90bce78aff5eda5.
/// @param transceiver The address of the transceiver.
/// @param transceiversNum The current number of transceivers.
/// @param threshold The current threshold of transceivers.
/// Event | TransceiverAdded(address,uint256,uint8) | 0xf05962b5774c658e85ed80c91a75af9d66d2af2253dda480f90bce78aff5eda5
export const TransceiverAddedTopic =
  '0xf05962b5774c658e85ed80c91a75af9d66d2af2253dda480f90bce78aff5eda5';

/// @notice Emitted when an transceiver is removed from the nttManager.
/// @dev Topic0
///     0x697a3853515b88013ad432f29f53d406debc9509ed6d9313dcfe115250fcd18f.
/// @param transceiver The address of the transceiver.
/// @param threshold The current threshold of transceivers.
/// Event | TransceiverRemoved(address,uint8) | 0x697a3853515b88013ad432f29f53d406debc9509ed6d9313dcfe115250fcd18f
export const TransceiverRemovedTopic =
  '0x697a3853515b88013ad432f29f53d406debc9509ed6d9313dcfe115250fcd18f';

/// @notice Emitted when a message has already been executed to
///         notify client of against retries.
/// @dev Topic0
///      0x4069dff8c9df7e38d2867c0910bd96fd61787695e5380281148c04932d02bef2.
/// @param sourceNttManager The address of the source nttManager.
/// @param msgHash The keccak-256 hash of the message.
/// event MessageAlreadyExecuted(bytes32 indexed sourceNttManager, bytes32 indexed msgHash);
export const MessageAlreadyExecutedTopic =
  '0x4069dff8c9df7e38d2867c0910bd96fd61787695e5380281148c04932d02bef2';

/// @notice Emitted when a transfer has been redeemed
///         (either minted or unlocked on the recipient chain).
/// @dev Topic0
///      0x504e6efe18ab9eed10dc6501a417f5b12a2f7f2b1593aed9b89f9bce3cf29a91.
/// @param Topic1
///      digest The digest of the message.
/// event TransferRedeemed(bytes32 indexed digest);
export const TransferRedeemedTopic =
  '0x504e6efe18ab9eed10dc6501a417f5b12a2f7f2b1593aed9b89f9bce3cf29a91';

/// @notice Emitted when an outbound transfer has been cancelled
/// @dev Topic0
///      0xf80e572ae1b63e2449629b6c7d783add85c36473926f216077f17ee002bcfd07.
/// @param sequence The sequence number being cancelled
/// @param recipient The canceller and recipient of the funds
/// @param amount The amount of the transfer being cancelled
// event OutboundTransferCancelled(uint256 sequence, address recipient, uint256 amount);
export const OutboundTransferCancelledTopic =
  '0xf80e572ae1b63e2449629b6c7d783add85c36473926f216077f17ee002bcfd07';

// All topics:
export const NTT_TOPICS = [
  InboundTransferQueuedTopic,
  OutboundTransferQueuedTopic,
  OutboundTransferRateLimitedTopic,
  TransferSentTopic,
  PeerUpdatedTopic,
  MessageAttestedToTopic,
  ThresholdChangedTopic,
  TransceiverAddedTopic,
  TransceiverRemovedTopic,
  MessageAlreadyExecutedTopic,
  TransferRedeemedTopic,
  OutboundTransferCancelledTopic,
];

// Lifecycle topics:
export const NTT_LIFECYCLE_TOPICS = [
  InboundTransferQueuedTopic,
  OutboundTransferQueuedTopic,
  OutboundTransferRateLimitedTopic,
  TransferSentTopic,
  TransferRedeemedTopic,
];

export const TransferLockIx = 'transferLock';
export const TransferBurnIx = 'transferBurn';
export const RedeemIx = 'redeem';
export const ReleaseInboundMintIx = 'releaseInboundMint';
export const ReleaseInboundUnlockIx = 'releaseInboundUnlock';
export const ReceiveWormholeMessageIx = 'receiveWormholeMessage';
export const ReleaseWormholeOutboundIx = 'releaseWormholeOutbound';
export const RequestRelayIx = 'requestRelay';

export const NTT_DECIMALS = 8;

export const NTT_SOLANA_IXS = [
  TransferLockIx,
  TransferBurnIx,
  RedeemIx,
  ReleaseInboundMintIx,
  ReleaseInboundUnlockIx,
  ReceiveWormholeMessageIx,
  ReleaseWormholeOutboundIx,
  RequestRelayIx,
];

export const NTT_CONTRACT: { [key in Network]: { [key in Chain]?: string[] } } = {
  ['Mainnet']: {
    Ethereum: ['0xeBdCe9a913d9400EE75ef31Ce8bd34462D01a1c1'],
    Fantom: [
      '0x68dB2f05Aa2d77DEf981fd2be32661340c9222FB',
      '0x2F733095B80A04b38b0D10cC884524a3d09b836a',
    ],
  },
  ['Testnet']: {
    Solana: ['nTTh3bZ5Aer6xboWZe39RDEft4MeVxSQ8D1EYAVLZw9'],
    Sepolia: ['0xB231aD95f2301bc82eA44c515001F0F746D637e0'],
    ArbitrumSepolia: ['0xEec94CD3083e067398256a79CcA7e740C5c8ef81'],
    BaseSepolia: ['0xB03b030b2f5B40819Df76467d67eD1C85Ff66fAD'],
    OptimismSepolia: ['0x7f430D4e7939D994C0955A01FC75D9DE33F12D11'],
  },
  ['Devnet']: {},
};

export const NTT_QUOTER_CONTRACT: { [key in Network]: { [key in Chain]?: string } } = {
  ['Mainnet']: {},
  ['Testnet']: {
    Solana: 'NqTdGLLL6b6bFo7YESNEezocgF8onH5cst5EdH791en',
  },
  ['Devnet']: {},
};

export const getNttManagerMessageDigest = (
  emitterChain: number,
  message: NttManagerMessage<NativeTokenTransfer>
): string => {
  const chainIdBuffer = Buffer.alloc(2);
  chainIdBuffer.writeUInt16BE(emitterChain);
  const serialized = NttManagerMessage.serialize(message, NativeTokenTransfer.serialize);
  const digest = keccak256(Buffer.concat([chainIdBuffer, serialized]));
  return Buffer.from(digest).toString('hex');
};

export type LifeCycle = {
  srcChainId: number;
  destChainId: number;
  sourceToken: string;
  tokenAmount: bigint;
  transferSentTxhash: string;
  transferBlockHeight: bigint;
  redeemedTxhash: string;
  redeemedBlockHeight: bigint;
  nttTransferKey: string;
  vaaId: string;
  digest: string;
  isRelay: boolean;
  transferTime: string;
  redeemTime: string;
  inboundTransferQueuedTime: string;
  outboundTransferQueuedTime: string;
  outboundTransferReleasableTime: string;
};

export const createNewLifeCycle = (): LifeCycle => {
  return {
    srcChainId: 0,
    destChainId: 0,
    sourceToken: '',
    tokenAmount: BigInt(0),
    transferSentTxhash: '',
    transferBlockHeight: BigInt(0),
    redeemedTxhash: '',
    redeemedBlockHeight: BigInt(0),
    nttTransferKey: '',
    vaaId: '',
    digest: '',
    isRelay: false,
    transferTime: '',
    redeemTime: '',
    inboundTransferQueuedTime: '',
    outboundTransferQueuedTime: '',
    outboundTransferReleasableTime: '',
  };
};
