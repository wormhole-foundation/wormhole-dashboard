import { jest, test, expect } from '@jest/globals';
import { FTSolanaWatcher } from '../FTSolanaWatcher';

jest.setTimeout(60_000);

// This test is working, but testing it is not very useful since the return value is just the lastBlockKey.
// It is just an entrypoint to test the whole thing with a local postgres database.
// Skipping because it requires db
test.skip('getMessagesByBlock', async () => {
  const watcher = new FTSolanaWatcher('Testnet');
  await watcher.getFtMessagesForBlocks(313236172, 314175735);
});

test('placeInitialOfferCctp', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);

  const txHash =
    '622s4otqmig2LB6AjnhvQv4gwBpUX9Ewnnh2XKa7YfsRhr4h1AU1GJRweii4C9rwqNzX1piMQ3jZQTMTv7aS4pyE';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];
  const decodedData = watcher.matchingEngineBorshCoder.instruction.decode(
    Buffer.from(ix.data),
    'base58'
  );
  if (!decodedData) {
    throw new Error('Unable to decode instruction');
  }

  const parsedLogs = await watcher.parsePlaceInitialOfferCctp(tx, ix, decodedData);

  expect(parsedLogs?.auction).toEqual({
    auction_pubkey: '77W4Votv6bK1tyq4xcvyo2V9gXYknXBwcZ53XErgcEs9',
    start_slot: 300551112n,
    end_slot: 300551117n,
    deadline_slot: 300551127n,
    initial_offer_timestamp: new Date('2024-05-22T06:05:16.000Z'),
    initial_offer_tx_hash:
      '622s4otqmig2LB6AjnhvQv4gwBpUX9Ewnnh2XKa7YfsRhr4h1AU1GJRweii4C9rwqNzX1piMQ3jZQTMTv7aS4pyE',
    best_offer_amount: 1500000n,
    best_offer_token: 'tomvTppiaT5T56Gm5gTegXnSEEf4tVBCz99VkcvYcT8',
    message_protocol: 'local',
    cctp_domain: undefined,
    local_program_id: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
    fast_vaa_hash: 'd59b2b7c01853524165f92524193af7a1c812277bf1898c00843fee64f9b4839',
  });

  expect(parsedLogs?.auction_offer).toEqual({
    fast_vaa_hash: 'd59b2b7c01853524165f92524193af7a1c812277bf1898c00843fee64f9b4839',
    payer: 'ToML4kX31x56WDnXW4mVzivUTgXk1kL53cmVTaNeaZi',
    is_initial_offer: true,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1500000n,
    tx_hash:
      '622s4otqmig2LB6AjnhvQv4gwBpUX9Ewnnh2XKa7YfsRhr4h1AU1GJRweii4C9rwqNzX1piMQ3jZQTMTv7aS4pyE',
    timestamp: new Date('2024-05-22T06:05:16.000Z'),
    slot: 300551112n,
  });
});

test('should parse improveOffer', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);

  const txHash =
    '5jD1at1xF6KKj5BzCuNZEhfNpEU4ho19pkdccm9xvtxs2AhYN1F1WNMj7uGtkkr4SrzT3DPzdZbEKMP6u5FVLzLy';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];
  const decodedData = watcher.matchingEngineBorshCoder.instruction.decode(
    Buffer.from(ix.data),
    'base58'
  );
  if (!decodedData) {
    throw new Error('Unable to decode instruction');
  }

  const message = await watcher.parseImproveOffer(tx, ix, decodedData);

  expect(message).toEqual({
    fast_vaa_hash: 'd863c96834b4d83003ab941697d43a64261345d77b3b4e8e64dab837a1378671',
    payer: 'gyVfT39y3tWQnfXwxY6Hj7ZeLFN2K8Z6heWEJ4zxYRB',
    is_initial_offer: false,
    slot: 293881583n,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1425000n,
    tx_hash:
      '5jD1at1xF6KKj5BzCuNZEhfNpEU4ho19pkdccm9xvtxs2AhYN1F1WNMj7uGtkkr4SrzT3DPzdZbEKMP6u5FVLzLy',
    timestamp: new Date('2024-04-22T13:34:12.000Z'),
  });
});

// TODO: solver is broken and not running after latest deployment,
// will update tests when they are fixed and running
test('should parse executeFastOrderLocal', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '7AfmUeb6sM4HRLyw8ZmmaC5R2SFAzgQAH4YbD2fmnDmDPAcdxAk9Rhi3xktrGoE7bB2VHiBhs3JSvgiFzo6yUPr';

  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[0];

  const info = await watcher.parseExecuteFastOrderLocal(tx, ix);
  expect(info).toEqual({
    penalty: 439875n,
    user_amount: 8293250n,
    execution_payer: 'ToML4kX31x56WDnXW4mVzivUTgXk1kL53cmVTaNeaZi',
    execution_slot: 300868424n,
    execution_time: new Date('2024-05-23T15:58:23.000Z'),
    execution_tx_hash: txHash,
    fast_vaa_hash: 'fd99d2d20f7458cae97de7d7bcf94cbdc5ac734264fa495bf01f1748e28039da',
    fill_id: 'B2qkDPs1gPh69uvKN5mbtHRAFtiMaZCe4vu6Wp3yaaJ1',
  });
});

test('should parse executeFastOrderCctp', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '4XiWZGfB9KymYuNgJP7z7rMcKroN3VXYL1QWAevZ4HNTgB3tgj1EGPdaeSgFA8uhj4QUNTdtB7aSb7pxNM7Vd77p';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[0];

  const info = await watcher.parseExecuteFastOrderCctp(tx, ix);

  expect(info).toEqual({
    user_amount: 8000000n,
    penalty: 0n,
    execution_tx_hash: txHash,
    execution_payer: 'RoXdiG9eHCYvZjrVfM6DTNSsX1xAzhubvEUxproxybn',
    execution_slot: 301864332n,
    execution_time: new Date('2024-05-28T03:15:19.000Z'),
    fast_vaa_hash: '14a5187e40e4fd2b2950cd8332b4142259757f4cbf7cffcb7cc95249df8415b9',
    fill_id: '1/3e374fcd3aaf2ed067f3c93d21416855ec7916cfd2c2127bcbc68b3b1fb73077/7970',
  });
});

test('should parse settleAuctionComplete', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '5L2tBfpE35gHBTRmqet4UUGoUJrwYZe6LVCLomVkEDU1TBXNbWW2Xs8pPT5Zz2JQgX2vS8pE4bxmyDEZxL9fBVbs';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];

  const info = await watcher.parseSettleAuctionComplete(tx, ix, 1);
  expect(info).toEqual({
    fast_vaa_hash: '',
    repayment: 1000000n,
    settle_payer: '6H68dreG5qZHUVjBwf4kCGQYmW3hULedbezwzPasTr68',
    settle_slot: 302130744n,
    settle_time: new Date('2024-05-29T08:09:11.000Z'),
    settle_tx_hash:
      '5L2tBfpE35gHBTRmqet4UUGoUJrwYZe6LVCLomVkEDU1TBXNbWW2Xs8pPT5Zz2JQgX2vS8pE4bxmyDEZxL9fBVbs',
  });
});

test('should parse settleAuctionNoneLocal', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '3fdXiWz25RxQacjDtG1cW5K4qhMFtXHipz8waGrpZee2Q321aCftdjfQDNuU1kGiqsiixq7nkK4apXyB7cHWWxhX';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[0];

  const info = await watcher.parseSettleAuctionNoneLocal(tx, ix);
  expect(info).toEqual({
    fast_vaa_hash: '',
    repayment: 0n,
    settle_payer: 'BxNyqSkqwNWK6f11KkNWffGJGQ8VSo2LbSQXKobAGSsB',
    settle_slot: 304808273n,
    settle_time: new Date('2024-06-10T17:04:59.000Z'),
    settle_tx_hash:
      '3fdXiWz25RxQacjDtG1cW5K4qhMFtXHipz8waGrpZee2Q321aCftdjfQDNuU1kGiqsiixq7nkK4apXyB7cHWWxhX',
  });
});

// Skipping this since it requires database
test.skip('should fetch closed Auction', async () => {
  const watcher = new FTSolanaWatcher('Testnet');
  const auction = await watcher.fetchAuction('FS4EAzWA2WuMKyGBy2C7EBvHL9W63NDX9JR4CPveAiDK');

  if (!auction || !auction.info) {
    throw new Error('Auction not found');
  }

  // We need to convert one by one because we can't compare BN directly
  expect({
    vaaHash: auction.vaaHash,
    info: {
      configId: auction.info.configId,
      custodyTokenBump: auction.info.custodyTokenBump,
      vaaSequence: auction.info.vaaSequence.toString(10),
      sourceChain: auction.info.sourceChain,
      bestOfferToken: auction.info.bestOfferToken.toString(),
      initialOfferToken: auction.info.initialOfferToken.toString(),
      startSlot: auction.info.startSlot.toString(10),
      amountIn: auction.info.amountIn.toString(10),
      securityDeposit: auction.info.securityDeposit.toString(10),
      offerPrice: auction.info.offerPrice.toString(10),
      redeemerMessageLen: auction.info.redeemerMessageLen,
      destinationAssetInfo: auction.info.destinationAssetInfo,
    },
  }).toEqual({
    vaaHash: '76cf535a7c06f6463c65db5c6cc8366494beb3742de4b64bb97c8c46bd6f1a63',
    info: {
      configId: 2,
      custodyTokenBump: 254,
      startSlot: '297529247',
      vaaSequence: '12193',
      sourceChain: 10005,
      bestOfferToken: 'RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e',
      initialOfferToken: 'RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e',
      amountIn: '10000000',
      securityDeposit: '2550000',
      offerPrice: '1500000',
      redeemerMessageLen: 0,
      destinationAssetInfo: null,
    },
  });
});

test('should fetch auction update from logs', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '2YJAG7smyau6GbuEQT9NHJmuj4BFQWc8XrF2CTsmh1m626ZEd681DJoRmzQQGhj51UATB84o8TqMMaehC8nsFrVa';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  if (!tx.meta?.logMessages) {
    throw new Error('No log messages');
  }
  const auctionUpdate = watcher.getAuctionUpdatedFromLogs(tx.meta.logMessages);

  if (!auctionUpdate) {
    throw new Error('Auction update not found');
  }

  expect({
    config_id: 2,
    auction: auctionUpdate.auction.toString(),
    vaa: auctionUpdate.vaa?.toString(),
    source_chain: auctionUpdate.source_chain,
    target_protocol: {
      Local: {
        program_id: auctionUpdate.target_protocol.Local?.program_id.toString(),
      },
    },
    redeemer_message_len: auctionUpdate.redeemer_message_len,
    end_slot: auctionUpdate.end_slot.toString(10),
    best_offer_token: auctionUpdate.best_offer_token.toString(),
    token_balance_before: auctionUpdate.token_balance_before.toString(10),
    amount_in: auctionUpdate.amount_in.toString(10),
    total_deposit: auctionUpdate.total_deposit.toString(10),
    max_offer_price_allowed: auctionUpdate.max_offer_price_allowed.toString(10),
  }).toEqual({
    config_id: 2,
    auction: '4Pmg1kmeMQnjoGYP2PzNxMyuBE8tP5YYZbqv7tayz9LC',
    vaa: '7GP7KfYUUSxLhQQCaBzmC5QDDQcWWqpm6nbGNDNpLh2p',
    source_chain: 10003,
    target_protocol: {
      Local: {
        program_id: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
      },
    },
    redeemer_message_len: 4,
    end_slot: '301745909',
    best_offer_token: 'RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e',
    token_balance_before: '11462602341',
    amount_in: '10000000',
    total_deposit: '12550000',
    max_offer_price_allowed: '1425000',
  });
});

// Skipped because it requires database
test.skip('should index all auction history', async () => {
  const watcher = new FTSolanaWatcher('Testnet');
  await watcher.indexAuctionHistory('77W4Votv6bK1tyq4xcvyo2V9gXYknXBwcZ53XErgcEs9');
});
