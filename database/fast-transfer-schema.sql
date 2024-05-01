CREATE TYPE FastTransferProtocol AS ENUM ('cctp', 'local', 'none');
CREATE TYPE FastTransferStatus AS ENUM ('pending', 'no_offer', 'executed', 'settled');

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
  timestamp TIMESTAMP NOT NULL,
  start_slot BIGINT NOT NULL,
  -- auction end on this slot
  end_slot BIGINT NOT NULL,
  -- deadline to execute the auction (end_slot + grace_period)
  deadline_slot BIGINT NOT NULL,
  -- current best offers
  best_offer_amount BIGINT,
  best_offer_token VARCHAR(255),
  -- Enum: cctp, local, wormhole
  message_protocol FastTransferProtocol NOT NULL DEFAULT 'none',
  cctp_domain INT NULL,
  local_program_id VARCHAR(255) NULL,
  -- execution data
  status FastTransferStatus NOT NULL DEFAULT 'pending',
  user_amount BIGINT,
  penalty BIGINT,
  execution_payer VARCHAR(255),
  execution_tx_hash VARCHAR(255),
  execution_slot BIGINT,
  execution_time TIMESTAMP,
  -- settle data
  repayment BIGINT,
  settle_payer VARCHAR(255),
  settle_tx_hash VARCHAR(255),
  settle_slot BIGINT,
  settle_time TIMESTAMP
);

-- Auction Logs tracks events of the auction
-- Events: placeInitialOfferCctp, improveOffer
CREATE TABLE auction_logs (
  tx_hash VARCHAR(255) PRIMARY KEY,
  fast_vaa_hash VARCHAR(255) NOT NULL,
  is_initial_offer BOOLEAN NOT NULL,
  payer VARCHAR(255) NOT NULL,
  slot BIGINT NOT NULL,
  amount_in BIGINT NOT NULL,
  security_deposit BIGINT NOT NULL,
  offer_price BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL
);
