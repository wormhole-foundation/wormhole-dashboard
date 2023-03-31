import { ParsedAttestMetaVaa, ParsedTokenTransferVaa } from '@certusone/wormhole-sdk';

// Note: bigint is handled as string to prevent precision loss - https://github.com/brianc/node-postgres/pull/353

export interface TokenMetadata {
  token_chain: number;
  token_address: string;
  native_address: string | null;
  coin_gecko_coin_id: string | null;
}

export interface TokenTransfer {
  timestamp: string; // bigint
  emitter_chain: number;
  emitter_address: string;
  sequence: string; // bigint
  amount: string; // bigint
  token_address: string;
  token_chain: number;
  to_address: string;
  to_chain: number;
  payload_type: number;
  fee: string | null; // bigint
  from_address: string | null;
}

export interface AttestMessage {
  timestamp: string; // bigint
  emitter_chain: number;
  emitter_address: string;
  sequence: string; // bigint
  token_address: string;
  token_chain: number;
  decimals: number;
  symbol: string;
  name: string;
}

export interface TokenPrice {
  date: string; // YYYY-MM-DD
  coin_gecko_coin_id: string;
  price_usd: number;
}

export const createTokenMetadata = (vaa: ParsedAttestMetaVaa): TokenMetadata => ({
  token_chain: vaa.tokenChain,
  token_address: vaa.tokenAddress.toString('hex'),
  native_address: null,
  coin_gecko_coin_id: null,
});

export const createTokenTransfer = (vaa: ParsedTokenTransferVaa): TokenTransfer => ({
  timestamp: vaa.timestamp.toString(),
  emitter_chain: vaa.emitterChain,
  emitter_address: vaa.emitterAddress.toString('hex'),
  sequence: vaa.sequence.toString(),
  amount: vaa.amount.toString(),
  token_address: vaa.tokenAddress.toString('hex'),
  token_chain: vaa.tokenChain,
  to_address: vaa.to.toString('hex'),
  to_chain: vaa.toChain,
  payload_type: Number(vaa.payloadType),
  fee: vaa.fee !== null ? vaa.fee.toString() : null,
  from_address: vaa.fromAddress !== null ? vaa.fromAddress.toString('hex') : null,
});

export const createAttestMessage = (vaa: ParsedAttestMetaVaa): AttestMessage => ({
  timestamp: vaa.timestamp.toString(),
  emitter_chain: vaa.emitterChain,
  emitter_address: vaa.emitterAddress.toString('hex'),
  sequence: vaa.sequence.toString(),
  token_address: vaa.tokenAddress.toString('hex'),
  token_chain: vaa.tokenChain,
  decimals: vaa.decimals,
  symbol: vaa.symbol,
  name: vaa.name,
});
