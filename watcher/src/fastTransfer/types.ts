// Type definitions are snake_case to match the database schema
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
};

export type AuctionOffer = {
  fast_vaa_hash: string; // reference to fast_transfer.fast_vaa_hash
  // TODO: track domain and program id?
  start_slot: bigint;
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
