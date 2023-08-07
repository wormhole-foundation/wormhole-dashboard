CREATE TABLE token_metadata (
  token_chain INTEGER NOT NULL,
  token_address CHAR(64) NOT NULL,
  native_address TEXT,
  coin_gecko_coin_id TEXT,
  -- these fields are from the latest attest_message
  -- to make joins simpler at the cost of a little duplication
  decimals INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  -- 
  PRIMARY KEY (token_chain, token_address)
);

CREATE TABLE attest_message (
  timestamp BIGINT NOT NULL,
  emitter_chain INTEGER NOT NULL,
  emitter_address CHAR(64) NOT NULL,
  sequence DECIMAL(20, 0) NOT NULL,
  token_address CHAR(64) NOT NULL,
  token_chain INTEGER NOT NULL,
  decimals INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (emitter_chain, emitter_address, sequence)
);

CREATE TABLE token_transfer (
  timestamp BIGINT NOT NULL,
  emitter_chain INTEGER NOT NULL,
  emitter_address CHAR(64) NOT NULL,
  sequence DECIMAL(20, 0) NOT NULL,
  amount DECIMAL(78, 0) NOT NULL,
  token_address CHAR(64) NOT NULL,
  token_chain INTEGER NOT NULL,
  to_address CHAR(64) NOT NULL,
  to_chain INTEGER NOT NULL,
  payload_type INTEGER NOT NULL,
  fee DECIMAL(78, 0),
  from_address CHAR(64),
  module CHAR(64) NOT NULL,
  PRIMARY KEY (emitter_chain, emitter_address, sequence)
);

CREATE TABLE token_price_history (
  date DATE NOT NULL,
  coin_gecko_coin_id TEXT NOT NULL,
  price_usd DECIMAL NOT NULL,
  PRIMARY KEY (date, coin_gecko_coin_id)
);