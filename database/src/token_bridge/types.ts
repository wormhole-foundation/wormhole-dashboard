import { ParsedAttestMetaVaa, ParsedTokenTransferVaa } from '@certusone/wormhole-sdk';

export interface TokenMetadata {
  token_chain: number;
  token_address: string;
  native_address: string | null;
  coin_gecko_coin_id: string | null;
}

export interface TokenTransfer {
  timestamp: bigint;
  emitter_chain: number;
  emitter_address: string;
  sequence: bigint;
  amount: bigint;
  token_address: string;
  token_chain: number;
  to_address: string;
  to_chain: number;
  payload_type: number;
  fee: bigint | null;
  from_address: string | null;
}

export interface AttestMessage {
  timestamp: bigint;
  emitter_chain: number;
  emitter_address: string;
  sequence: bigint;
  token_address: string;
  token_chain: number;
  decimals: number;
  symbol: string;
  name: string;
}

export const createTokenMetadata = (vaa: ParsedAttestMetaVaa): TokenMetadata => ({
  token_chain: vaa.tokenChain,
  token_address: vaa.tokenAddress.toString('hex'),
  native_address: null,
  coin_gecko_coin_id: null,
});

export const createTokenTransfer = (vaa: ParsedTokenTransferVaa): TokenTransfer => ({
  timestamp: BigInt(vaa.timestamp),
  emitter_chain: vaa.emitterChain,
  emitter_address: vaa.emitterAddress.toString('hex'),
  sequence: vaa.sequence,
  amount: vaa.amount,
  token_address: vaa.tokenAddress.toString('hex'),
  token_chain: vaa.tokenChain,
  to_address: vaa.to.toString('hex'),
  to_chain: vaa.toChain,
  payload_type: Number(vaa.payloadType),
  fee: vaa.fee,
  from_address: vaa.fromAddress != null ? vaa.fromAddress.toString('hex') : null,
});

export const createAttestMessage = (vaa: ParsedAttestMetaVaa): AttestMessage => ({
  timestamp: BigInt(vaa.timestamp),
  emitter_chain: vaa.emitterChain,
  emitter_address: vaa.emitterAddress.toString('hex'),
  sequence: vaa.sequence,
  token_address: vaa.tokenAddress.toString('hex'),
  token_chain: vaa.tokenChain,
  decimals: vaa.decimals,
  symbol: vaa.symbol,
  name: vaa.name,
});
