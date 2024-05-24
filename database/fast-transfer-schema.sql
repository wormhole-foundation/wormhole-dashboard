DROP TABLE IF EXISTS market_orders;
DROP TABLE IF EXISTS fast_transfer_auctions;
DROP TABLE IF EXISTS fast_transfer_executions;
DROP TABLE IF EXISTS fast_transfer_settlements;
DROP TABLE IF EXISTS auction_logs;

DROP TYPE IF EXISTS FastTransferStatus;
DROP TYPE IF EXISTS FastTransferProtocol;

CREATE TYPE FastTransferProtocol AS ENUM ('cctp', 'local', 'none');
CREATE TYPE FastTransferStatus AS ENUM ('pending', 'no_offer', 'executed', 'settled', 'auction');

-- Market Order tracks events of when fast market orders are
-- placed in the token router
CREATE TABLE market_orders (
  fast_vaa_id VARCHAR(255) PRIMARY KEY,
  fast_vaa_hash VARCHAR(255),
  amount_in BIGINT,
  min_amount_out BIGINT,
  src_chain INTEGER,
  dst_chain INTEGER,
  sender VARCHAR(255),
  redeemer VARCHAR(255),
  market_order_tx_hash VARCHAR(255),
  market_order_timestamp TIMESTAMP,
  status FastTransferStatus NOT NULL DEFAULT 'pending'
);

-- Auction tracks the latest state of the auction.
-- It is created when the auction is created in the `placeInitialOfferCctp`
-- ix in the MatchingEngine contract.
CREATE TABLE fast_transfer_auctions (
  fast_vaa_hash VARCHAR(255) PRIMARY KEY,
  auction_pubkey VARCHAR(255),
  initial_offer_tx_hash VARCHAR(255),
  initial_offer_timestamp TIMESTAMP,
  start_slot BIGINT,
  end_slot BIGINT,
  deadline_slot BIGINT,
  best_offer_amount BIGINT,
  best_offer_token VARCHAR(255),
  message_protocol FastTransferProtocol DEFAULT 'none',
  cctp_domain INT,
  local_program_id VARCHAR(255)
);

-- Execution is created when the execution is created in the `executeFastOrder`
-- ix in the MatchingEngine contract.
CREATE TABLE fast_transfer_executions (
  fast_vaa_hash VARCHAR(255) PRIMARY KEY,
  user_amount BIGINT,
  penalty BIGINT,
  execution_payer VARCHAR(255),
  execution_tx_hash VARCHAR(255),
  execution_slot BIGINT,
  execution_time TIMESTAMP
);

-- Settlement is created when the settlement is created in the `settleFastTransfer`
-- ix in the MatchingEngine contract.
CREATE TABLE fast_transfer_settlements (
  fast_transfer_id VARCHAR(255) PRIMARY KEY,
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
