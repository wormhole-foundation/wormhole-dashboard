DROP TABLE IF EXISTS market_orders;
DROP TABLE IF EXISTS fast_transfer_auctions;
DROP TABLE IF EXISTS fast_transfer_executions;
DROP TABLE IF EXISTS fast_transfer_settlements;
DROP TABLE IF EXISTS auction_logs;
DROP TABLE IF EXISTS auction_history_mapping;
DROP TABLE IF EXISTS redeem_swaps;

DROP TYPE IF EXISTS FastTransferStatus;
DROP TYPE IF EXISTS FastTransferProtocol;

CREATE TYPE FastTransferProtocol AS ENUM ('cctp', 'local', 'none');
CREATE TYPE FastTransferStatus AS ENUM ('pending', 'no_offer', 'executed', 'settled', 'auction');

-- Market Order tracks events of when fast market orders are
-- placed in the token router
CREATE TABLE market_orders (
  -- These two cant be primary key because on different stages they might initially be null due to the inability to find them
  -- To accomodate this we put a unique constraint to allow nullable
  -- It will eventually be filled up 
  fast_vaa_id VARCHAR(255) UNIQUE,
  fast_vaa_hash VARCHAR(255) UNIQUE,
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
  execution_time TIMESTAMP,
  -- fill_id can be a vaa id (cctp) or solana account pubkey (local)
  fill_id VARCHAR(255)
);

-- Settlement is created when the settlement is created in the `settleFastTransfer`
-- ix in the MatchingEngine contract.
CREATE TABLE fast_transfer_settlements (
  fast_vaa_hash VARCHAR(255) PRIMARY KEY,
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

-- Auction History Mapping tracks which auction history pubkey is associated with
-- which auction pubkey. This is to prevent having to search for the auction in auction
-- history on chain which takes O(n) time, where n is the number of auction histories.
CREATE TABLE auction_history_mapping (
  auction_pubkey VARCHAR(255) PRIMARY KEY,
  index INT NOT NULL
);

-- Redeem Swaps table to track the final swap before funds reach the user's account
CREATE TABLE redeem_swaps (
  -- fill_id can be a vaa id (cctp) or solana account pubkey (local)
  fill_id VARCHAR(255) PRIMARY KEY,
  tx_hash VARCHAR(255) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  output_token VARCHAR(255) NOT NULL,
  output_amount BIGINT NOT NULL,
  relaying_fee BIGINT NOT NULL,
  redeem_time TIMESTAMP NOT NULL
);
