import { ChainName, keccak256 } from '@certusone/wormhole-sdk';
import { Environment } from '@wormhole-foundation/wormhole-monitor-common';
import { NativeTokenTransfer, NttManagerMessage } from './watchers/NTTPayloads';

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
///      0x754d657d1363ee47d967b415652b739bfe96d5729ccf2f26625dcdbc147db68b.
/// @param sender The initial sender of the transfer.
/// @param amount The amount to be transferred.
/// @param currentCapacity The capacity left for transfers within the 24-hour window.:w
/// event OutboundTransferRateLimited( address indexed sender, uint64 sequence, uint256 amount, uint256 currentCapacity);
export const OutboundTransferRateLimitedTopic =
  '0x754d657d1363ee47d967b415652b739bfe96d5729ccf2f26625dcdbc147db68b';

//
// The following are from INttManagerEvents.sol
//

/// @notice Emitted when a message is sent from the nttManager.
/// @dev Topic0
///      0x9716fe52fe4e02cf924ae28f19f5748ef59877c6496041b986fbad3dae6a8ecf
/// @param recipient The recipient of the message.
/// @param amount The amount transferred.
/// @param fee The amount of ether sent along with the tx to cover the delivery fee.
/// @param recipientChain The chain ID of the recipient.
/// @param msgSequence The unique sequence ID of the message.
/// event TransferSent( bytes32 recipient, uint256 amount, uint256 fee, uint16 recipientChain, uint64 msgSequence);
export const TransferSentTopic =
  '0x9716fe52fe4e02cf924ae28f19f5748ef59877c6496041b986fbad3dae6a8ecf';

/// @notice Emitted when the peer contract is updated.
/// @dev Topic0
///      0x51b8437a7e22240c473f4cbdb4ed3a4f4bf5a9e7b3c511d7cfe0197325735700.
/// @param chainId_ The chain ID of the peer contract.
/// @param oldPeerContract The old peer contract address.
/// @param peerContract The new peer contract address.
/// event PeerUpdated(uint16 indexed chainId_, bytes32 oldPeerContract, bytes32 peerContract);
export const PeerUpdatedTopic =
  '0x51b8437a7e22240c473f4cbdb4ed3a4f4bf5a9e7b3c511d7cfe0197325735700';

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
///      0xc6289e62021fd0421276d06677862d6b328d9764cdd4490ca5ac78b173f25883.
/// @param transceiver The address of the transceiver.
/// @param transceiversNum The current number of transceivers.
/// @param threshold The current threshold of transceivers.
/// event TransceiverAdded(address transceiver, uint256 transceiversNum, uint8 threshold);
export const TransceiverAddedTopic =
  '0xc6289e62021fd0421276d06677862d6b328d9764cdd4490ca5ac78b173f25883';

/// @notice Emitted when an transceiver is removed from the nttManager.
/// @dev Topic0
///     0x638e631f34d9501a3ff0295873b29f50d0207b5400bf0e48b9b34719e6b1a39e.
/// @param transceiver The address of the transceiver.
/// @param threshold The current threshold of transceivers.
/// event TransceiverRemoved(address transceiver, uint8 threshold);
export const TransceiverRemovedTopic =
  '0x638e631f34d9501a3ff0295873b29f50d0207b5400bf0e48b9b34719e6b1a39e';

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
];

export const TransferLockIx = 'transferLock';
export const TransferBurnIx = 'transferBurn';
export const RedeemIx = 'redeem';
export const ReleaseInboundMintIx = 'releaseInboundMint';
export const ReleaseInboundUnlockIx = 'releaseInboundUnlock';
export const ReceiveWormholeMessageIx = 'receiveWormholeMessage';
export const ReleaseWormholeOutboundIx = 'releaseWormholeOutbound';

export const NTT_SOLANA_IXS = [
  TransferLockIx,
  TransferBurnIx,
  RedeemIx,
  ReleaseInboundMintIx,
  ReleaseInboundUnlockIx,
  ReceiveWormholeMessageIx,
  ReleaseWormholeOutboundIx,
];

export const NTT_CONTRACT: { [key in Environment]: { [key in ChainName]?: string[] } } = {
  ['mainnet']: {},
  ['testnet']: {
    solana: ['nTTh3bZ5Aer6xboWZe39RDEft4MeVxSQ8D1EYAVLZw9'],
    sepolia: ['0xB231aD95f2301bc82eA44c515001F0F746D637e0'],
    arbitrum_sepolia: ['0xEec94CD3083e067398256a79CcA7e740C5c8ef81'],
    base_sepolia: ['0xB03b030b2f5B40819Df76467d67eD1C85Ff66fAD'],
    optimism_sepolia: ['0x7f430D4e7939D994C0955A01FC75D9DE33F12D11'],
  },
  ['devnet']: {},
};

export const getNttManagerMessageDigest = (
  emitterChain: number,
  message: NttManagerMessage<NativeTokenTransfer>
): string => {
  const chainIdBuffer = Buffer.alloc(2);
  chainIdBuffer.writeUInt16BE(emitterChain);
  const serialized = NttManagerMessage.serialize(message, NativeTokenTransfer.serialize);
  const digest = keccak256(Buffer.concat([chainIdBuffer, serialized]));
  return digest.toString('hex');
};

export type LifeCycle = {
  srcChainId: number;
  destChainId: number;
  sourceToken: string;
  tokenAmount: bigint;
  transferSentTxhash: string;
  redeemedTxhash: string;
  nttTransferKey: string;
  vaaId: string;
  digest: string;
  transferTime: string;
  redeemTime: string;
  inboundTransferQueuedTime: string;
  outboundTransferQueuedTime: string;
  outboundTransferRateLimitedTime: string;
};
