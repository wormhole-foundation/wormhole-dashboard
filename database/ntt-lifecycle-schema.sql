
CREATE TABLE life_cycle (
  from_chain INTEGER,
  to_chain INTEGER,
  from_token VARCHAR(96),
  token_amount DECIMAL(78, 0),
  transfer_sent_txhash VARCHAR(96),
  redeemed_txhash VARCHAR(96),
  ntt_transfer_key VARCHAR(256),
  vaa_id VARCHAR(128),
  digest VARCHAR(96) NOT NULL,
  transfer_time TIMESTAMP,
  redeem_time TIMESTAMP,
  inbound_transfer_queued_time TIMESTAMP,
  outbound_transfer_queued_time TIMESTAMP,
  outbound_transfer_rate_limited_time TIMESTAMP,
	PRIMARY KEY (digest)
);
