
CREATE TABLE life_cycle (
  from_chain INTEGER,
  to_chain INTEGER,
  from_token VARCHAR(96),
  token_amount DECIMAL(78, 0),
  transfer_sent_txhash VARCHAR(96),
  transfer_block_height BIGINT,
  redeemed_txhash VARCHAR(96),
  redeemed_block_height BIGINT,
  ntt_transfer_key VARCHAR(256),
  vaa_id VARCHAR(128),
  digest VARCHAR(96) NOT NULL,
  is_relay BOOLEAN,
  transfer_time TIMESTAMP,
  redeem_time TIMESTAMP,
  inbound_transfer_queued_time TIMESTAMP,
  outbound_transfer_queued_time TIMESTAMP,
  outbound_transfer_releasable_time TIMESTAMP,
	PRIMARY KEY (digest)
);

-- This is needed since releaseInboundMint/releaseInboundUnlock does not reference the digest
-- The redeem stage refers to both digest and inboxItem. Since inboxItem is unique for every transfer
-- we can use it as a primary key.
-- Row will be deleted when the transfer is fully redeemed, aka releaseInboundMint/releaseInboundUnlock is called.
CREATE TABLE inbox_item_to_lifecycle_digest (
    inbox_item VARCHAR(96) NOT NULL,
    digest VARCHAR(96) NOT NULL,
    PRIMARY KEY (inbox_item)
);

-- This is needed since requestRelay does not reference the digest
-- The transfer stage refers to both digest and outboxItem. Since outboxItem is unique for every transfer
-- we can use it as a primary key.
-- Row will be deleted when the requestRelay is executed or when receiveWormhole is called.
-- We will truly know if the transfer is relayed when the transfer reaches the dest chain.
CREATE TABLE outbox_item_to_lifecycle_digest (
    outbox_item VARCHAR(96) NOT NULL,
    digest VARCHAR(96) NOT NULL,
    PRIMARY KEY (outbox_item)
    INDEX idx_digest (digest)
);
