import BN from 'bn.js'; // Imported since FT codebase uses BN

// Type definitions are snake_case to match the database schema
export enum FastTransferProtocol {
  CCTP = 'cctp',
  LOCAL = 'local',
  NONE = 'none',
}

export enum FastTransferStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  SETTLED = 'settled',
  EXPIRED = 'expired',
}

export type FastTransfer = {
  fast_transfer_id: string;
  fast_vaa_hash: string;
  auction_pubkey: string;
  amount: bigint;
  initial_offer_time: Date;
  src_chain: number;
  dst_chain: number;
  sender: string;
  redeemer: string;
  tx_hash: string;
  timestamp: Date;
  start_slot: bigint;
  end_slot: bigint;
  deadline_slot: bigint;
  // === best offer fields ===
  best_offer_amount?: bigint;
  best_offer_token?: string;
  // === protocol fields ===
  message_protocol: FastTransferProtocol;
  cctp_domain?: number;
  local_program_id?: string;
  // === fast transfer execution fields ===
  execution_payer?: string;
  execution_slot?: bigint;
  execution_time?: Date;
  execution_tx_hash?: string;
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

export type ParsedLogs = {
  fast_transfer: FastTransfer | null;
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
  auction_pubkey?: string;
};

export type FastTransferImprovementInfo = {
  best_offer_token: string;
  best_offer_amount: bigint;
};

export type FastTransferExecutionInfo = {
  status: string;
  user_amount: bigint;
  // amount that a winner will be penalized for not executing the fast transfer
  penalty: bigint;
  execution_payer: string;
  execution_time: Date;
  execution_tx_hash: string;
  execution_slot: bigint;
};

export type FastTransferSettledInfo = {
  status: string;
  // amount that the executor will receive for executing the fast transfer
  repayment: bigint;
  settle_tx_hash: string;
  settle_time: Date;
  settle_slot: bigint;
  settle_payer: string;
};
