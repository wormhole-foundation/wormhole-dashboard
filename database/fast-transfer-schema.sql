CREATE TABLE fast_transfers (
  fast_transfer_id VARCHAR(255) PRIMARY KEY,
  fast_vaa_hash VARCHAR(255) NOT NULL,
  auction_pubkey VARCHAR(255),
  amount BIGINT NOT NULL,
  initial_offer_time TIMESTAMP,
  src_chain INTEGER NOT NULL,
  dst_chain INTEGER NOT NULL,
  sender VARCHAR(255) NOT NULL,
  redeemer VARCHAR(255) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL
);

-- Auction Logs tracks events of the auction
-- Events: placeInitialOfferCctp, improveOffer
CREATE TABLE auction_logs (
  tx_hash VARCHAR(255) PRIMARY KEY,
  fast_vaa_hash VARCHAR(255) NOT NULL,
  start_slot BIGINT NOT NULL,
  amount_in BIGINT NOT NULL,
  security_deposit BIGINT NOT NULL,
  offer_price BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL
);
