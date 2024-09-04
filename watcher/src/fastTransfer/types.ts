import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js'; // Imported since FT codebase uses BN

// Type definitions are snake_case to match the database schema
export enum FastTransferProtocol {
  CCTP = 'cctp',
  LOCAL = 'local',
  NONE = 'none',
}

export enum FastTransferStatus {
  PENDING = 'pending', // market order is placed but no auction started
  AUCTION = 'auction', // auction started and ongoing
  EXECUTED = 'executed', // fast transfer executed
  SETTLED = 'settled', // fast transfer settled
  NO_OFFER = 'no_offer', // no offer made for the auction. Confirmed in settlement phase
}

export type MarketOrder = {
  fast_vaa_id: string;
  // fast_vaa_hash is null on tokenRouter, easier to get this on matching engine
  // but we still want this to link fast transfer to the other stages
  fast_vaa_hash?: string;
  amount_in: bigint;
  min_amount_out?: bigint;
  src_chain: number;
  dst_chain: number;
  sender: string;
  redeemer: string;
  market_order_tx_hash: string;
  market_order_timestamp: Date;
};

export type FastTransferAuctionInfo = {
  fast_vaa_hash: string;
  auction_pubkey: string;
  initial_offer_tx_hash: string;
  initial_offer_timestamp: Date;
  start_slot: bigint;
  end_slot: bigint;
  deadline_slot: bigint;
  best_offer_amount: bigint;
  best_offer_token: string;
  message_protocol: FastTransferProtocol;
  cctp_domain?: number;
  local_program_id?: string;
};

export type FastTransferExecutionInfo = {
  fast_vaa_hash: string;
  user_amount: bigint;
  // amount that a winner will be penalized for not executing the fast transfer
  penalty: bigint;
  execution_payer: string;
  execution_time: Date;
  execution_tx_hash: string;
  execution_slot: bigint;
  // fill_id can be a vaa id (cctp) or a Solana public key
  fill_id: string;
};

export type FastTransferSettledInfo = {
  fast_vaa_hash: string;
  // amount that the executor will receive for executing the fast transfer
  repayment: bigint;
  settle_tx_hash: string;
  settle_time: Date;
  settle_slot: bigint;
  settle_payer: string;
};

export type AuctionOffer = {
  fast_vaa_hash: string; // reference to fast_transfer.fast_vaa_hash
  payer: string;
  is_initial_offer: boolean;
  slot: bigint; // to track if offer was made when expired
  amount_in: bigint;
  security_deposit: bigint;
  offer_price: bigint;
  tx_hash: string;
  timestamp: Date;
};

export type FastTransferUpdate = {
  status?: FastTransferStatus;
  fast_vaa_hash?: string;
  fast_vaa_id?: string;
};

export type FastTransferAuctionUpdate = {
  best_offer_token?: string;
  best_offer_amount?: bigint;
};

export type ParsedLogs = {
  auction: FastTransferAuctionInfo;
  auction_offer: AuctionOffer | null;
};

export type OfferArgs = {
  offer_price: BN;
};

// Type guard to check if an object is of type ImproveOfferArgs
export function isOfferArgs(obj: any): obj is OfferArgs {
  return obj && obj.offer_price instanceof BN;
}

export type FastTransferId = {
  fast_vaa_hash?: string;
  fast_vaa_id?: string;
  auction_pubkey?: string;
};

// these can be found in the matchingEngineProgram, but we are making custom snake cased
// types to match the events in the logs parsed. Somehow anchor does not automatically convert
// the logs to the correct types
export type AuctionUpdated = {
  config_id: number;
  auction: PublicKey;
  vaa: PublicKey | null;
  source_chain: number;
  target_protocol: MessageProtocol;
  redeemer_message_len: number;
  end_slot: BN;
  best_offer_token: PublicKey;
  token_balance_before: BN;
  amount_in: BN;
  total_deposit: BN;
  max_offer_price_allowed: BN;
};

export type MessageProtocol = {
  Local?: {
    program_id: PublicKey;
  };
  Cctp?: {
    domain: number;
  };
  None?: {};
};

export type AuctionUpdatedEvent = {
  name: 'AuctionUpdated';
  data: AuctionUpdated;
};

export type TransferCompletion = {
  tx_hash: string;
  recipient: string;
  output_token: string;
  output_amount: bigint;
  relaying_fee: bigint;
  redeem_time: Date;
  fill_id: string;
  // on Solana Swap Layer, this acts as a link between complete_{transfer, swap}_payload and release_inbound
  staged_inbound?: string;
};

export type TokenInfo = {
  name: string;
  chain_id: number;
  decimals: number;
  symbol: string;
  token_address: string;
};
