CREATE TABLE
  token_metadata (
    token_chain INTEGER NOT NULL,
    token_address CHAR(64) NOT NULL,
    native_address TEXT,
    coin_gecko_coin_id TEXT,
    PRIMARY KEY (token_chain, token_address)
  );

CREATE TABLE
  attest_message (
    timestamp BIGINT NOT NULL,
    emitter_chain INTEGER NOT NULL,
    emitter_address CHAR(64) NOT NULL,
    sequence DECIMAL(20, 0) NOT NULL,
    token_address CHAR(64) NOT NULL,
    token_chain INTEGER NOT NULL,
    decimals INTEGER NOT NULL,
    symbol CHAR(64) NOT NULL,
    name CHAR(64) NOT NULL,
    PRIMARY KEY (emitter_chain, emitter_address, sequence)
  );

CREATE TABLE
  token_transfer (
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
    PRIMARY KEY (emitter_chain, emitter_address, sequence)
  );
