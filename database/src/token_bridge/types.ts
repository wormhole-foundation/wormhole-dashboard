import { toChainId } from '@wormhole-foundation/sdk-base';
import { TokenBridge } from '@wormhole-foundation/sdk-definitions';
import { universalAddress_stripped } from '@wormhole-foundation/wormhole-monitor-common';

// Note: bigint is handled as string to prevent precision loss - https://github.com/brianc/node-postgres/pull/353

export interface TokenMetadata {
  token_chain: number;
  token_address: string;
  native_address: string | null;
  coin_gecko_coin_id: string | null;
  decimals: number;
  symbol: string;
  name: string;
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
  module: string; // 'TokenBridge'
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

export const createTokenMetadata = (vaa: TokenBridge.AttestVAA): TokenMetadata => ({
  token_chain: toChainId(vaa.payload.token.chain),
  token_address: universalAddress_stripped(vaa.payload.token.address),
  native_address: null,
  coin_gecko_coin_id: null,
  decimals: vaa.payload.decimals,
  symbol: vaa.payload.symbol.replace(/\0/g, ''),
  name: vaa.payload.name.replace(/\0/g, ''),
});

export const createTokenTransfer = (vaa: TokenBridge.TransferVAA): TokenTransfer => ({
  timestamp: vaa.timestamp.toString(),
  emitter_chain: toChainId(vaa.emitterChain),
  emitter_address: universalAddress_stripped(vaa.emitterAddress),
  sequence: vaa.sequence.toString(),
  amount: vaa.payload.token.amount.toString(),
  token_address: universalAddress_stripped(vaa.payload.token.address),
  token_chain: toChainId(vaa.payload.token.chain),
  to_address: universalAddress_stripped(vaa.payload.to.address),
  to_chain: toChainId(vaa.payload.to.chain),
  module: vaa.protocolName,
  payload_type: vaa.payloadName === 'Transfer' ? 1 : 3,
  fee: vaa.payloadName === 'Transfer' ? vaa.payload.fee.toString() : null,
  from_address:
    vaa.payloadName === 'TransferWithPayload' ? universalAddress_stripped(vaa.payload.from) : null,
});

export const createAttestMessage = (vaa: TokenBridge.AttestVAA): AttestMessage => ({
  timestamp: vaa.timestamp.toString(),
  emitter_chain: toChainId(vaa.emitterChain),
  emitter_address: universalAddress_stripped(vaa.emitterAddress),
  sequence: vaa.sequence.toString(),
  token_address: universalAddress_stripped(vaa.payload.token.address),
  token_chain: toChainId(vaa.payload.token.chain),
  decimals: vaa.payload.decimals,
  symbol: vaa.payload.symbol.replace(/\0/g, ''),
  name: vaa.payload.name.replace(/\0/g, ''),
});
