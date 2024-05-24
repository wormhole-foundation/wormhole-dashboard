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
