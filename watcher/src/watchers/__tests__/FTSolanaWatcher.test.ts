import { jest, test, expect } from '@jest/globals';
import { FTSolanaWatcher } from '../FTSolanaWatcher';
import { VersionedTransactionResponse } from '@solana/web3.js';
import { getAllKeys } from '../../utils/solana';
import { all } from 'axios';

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
    '423vwjxR4c9Gqp55PnYPmyFxwfpqPXaNxACA7VBPgbDhfCg3xcBhggaMvRi8rpRyHmD5HqG1w1SLore9xWy3xBKQ';
  const tx: VersionedTransactionResponse | null = await watcher
    .getConnection()
    .getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const instructions = tx.transaction.message.compiledInstructions;
  const ix = instructions[4];
  const decodedData = watcher.matchingEngineBorshCoder.instruction.decode(
    Buffer.from(ix.data),
    'base58'
  );
  if (!decodedData) {
    throw new Error('Unable to decode instruction');
  }

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const parsedLogs = await watcher.parsePlaceInitialOfferCctp(tx, ix, decodedData, allKeys);

  expect(parsedLogs?.auction).toEqual({
    auction_pubkey: '4bWt4dFtWv9mqhDG8pHj55jui9K2oeQ5e9EJS5frhqcV',
    start_slot: 353708574n,
    end_slot: 353708579n,
    deadline_slot: 353708589n,
    initial_offer_timestamp: new Date('2025-01-13T00:40:03.000Z'),
    initial_offer_tx_hash:
      '423vwjxR4c9Gqp55PnYPmyFxwfpqPXaNxACA7VBPgbDhfCg3xcBhggaMvRi8rpRyHmD5HqG1w1SLore9xWy3xBKQ',
    best_offer_amount: 1500000n,
    best_offer_token: 'RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e',
    message_protocol: 'cctp',
    cctp_domain: 6,
    local_program_id: undefined,
    fast_vaa_hash: '1d910df52dd6ad9b5e4fe949725b2a0bb37f44aff2247a52793da373adeed269',
  });

  expect(parsedLogs?.auction_offer).toEqual({
    fast_vaa_hash: '1d910df52dd6ad9b5e4fe949725b2a0bb37f44aff2247a52793da373adeed269',
    payer: 'D1LLYchgdMZ8M8j8XdvUzCYCjZXhTMXSAg6WS1SAi7oN',
    is_initial_offer: true,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1500000n,
    tx_hash:
      '423vwjxR4c9Gqp55PnYPmyFxwfpqPXaNxACA7VBPgbDhfCg3xcBhggaMvRi8rpRyHmD5HqG1w1SLore9xWy3xBKQ',
    timestamp: new Date('2025-01-13T00:40:03.000Z'),
    slot: 353708574n,
  });
});

test('should parse improveOffer', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);

  const txHash =
    '35xaVogQ2hiijUr7CDZRtVtwT8hpGuWY39rbZNj4JiBKk7hnmb6zfSQ67vi28VKqm6yMuYe2weFSyZUbvh3R48dn';
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

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const message = await watcher.parseImproveOffer(tx, ix, decodedData, allKeys);

  expect(message).toEqual({
    fast_vaa_hash: '5a18cc9db80e108a1d767de3df94ed788541d3faa62797faeae15475846012f0',
    payer: 'RoXdiG9eHCYvZjrVfM6DTNSsX1xAzhubvEUxproxybn',
    is_initial_offer: false,
    slot: 353708581n,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1424999n,
    tx_hash:
      '35xaVogQ2hiijUr7CDZRtVtwT8hpGuWY39rbZNj4JiBKk7hnmb6zfSQ67vi28VKqm6yMuYe2weFSyZUbvh3R48dn',
    timestamp: new Date('2025-01-13T00:40:06.000Z'),
  });
});

// TODO: Need to find a tx of this type
test('should parse executeFastOrderLocal', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '4JtsAHkpz5Z8JBeyFYR8aveu2TzSaByU5L8t84ZEGcgvLV71FrQ1ymqZWSYZohGPsePEx79zsExnCkNS4cuuUktq';

  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[0];

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const info = await watcher.parseExecuteFastOrderLocal(tx, ix, allKeys);
  expect(info).toEqual({
    penalty: 1243125n,
    user_amount: 8828750n,
    execution_payer: 'RoXdiG9eHCYvZjrVfM6DTNSsX1xAzhubvEUxproxybn',
    execution_slot: 353711520n,
    execution_time: new Date('2025-01-13T00:58:57.000Z'),
    execution_tx_hash: txHash,
    fast_vaa_hash: 'b9dcba7c283a45209abf73c5bbfe3805311233c1f890f974cc157a4dff30c849',
    fill_id: '8WytAZnNfHAnJCuZgJLrzBonHZeAFe5qW18RKWGmUQGi',
  });
});

test('should parse executeFastOrderCctp', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '5UUTYgvwMVpvwCAYyxvK66etNwvZSH42woui4znFKFJ3KSs81nrfLKTwJBNG35nmNzgCu4ak9HPUGTe2R2mNUSdU';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });
  // console.log('tx', tx);

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const instructions = tx.transaction.message.compiledInstructions;
  // console.log('instructions', instructions);
  const ix = instructions[0];
  const decodedData = watcher.matchingEngineBorshCoder.instruction.decode(
    Buffer.from(ix.data),
    'base58'
  );
  const ixName = decodedData?.name;
  // console.log('ixName:', ixName);
  expect(ixName).toEqual('execute_fast_order_cctp');
  // console.log(
  //   'staticAccountKeys:',
  //   tx.transaction.message.staticAccountKeys.length,
  //   tx.transaction.message.staticAccountKeys
  // );

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const info = await watcher.parseExecuteFastOrderCctp(tx, ix, allKeys);

  expect(info).toEqual({
    user_amount: 8000000n,
    penalty: 0n,
    execution_tx_hash: txHash,
    execution_payer: 'RoXdiG9eHCYvZjrVfM6DTNSsX1xAzhubvEUxproxybn',
    execution_slot: 353711228n,
    execution_time: new Date('2025-01-13T00:57:05.000Z'),
    fast_vaa_hash: '4bc17ea5e7bf8d49636ea2bb23b95b17a5c632040c30a572253f9a2f0900ec22',
    fill_id: '1/3e374fcd3aaf2ed067f3c93d21416855ec7916cfd2c2127bcbc68b3b1fb73077/13740',
  });
});

test('should parse settleAuctionComplete', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    'hmssYE19XoyBf357XHKZmRRrr3cS33P4Dnhg4PYQpAj87G2Hk2FndrPwRMeRc1wtKRy1Tc4L5ZNRu5QtsnmPsHM';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const info = await watcher.parseSettleAuctionComplete(tx, ix, 1, allKeys);
  expect(info).toEqual({
    fast_vaa_hash: '',
    repayment: 10000000n,
    settle_payer: 'BGb8DoXNUKSVE8vxbu9nVA6t4Xxr96LF3wRfx2ZoiuQp',
    settle_slot: 353711965n,
    settle_time: new Date('2025-01-13T01:01:48.000Z'),
    settle_tx_hash:
      'hmssYE19XoyBf357XHKZmRRrr3cS33P4Dnhg4PYQpAj87G2Hk2FndrPwRMeRc1wtKRy1Tc4L5ZNRu5QtsnmPsHM',
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

  const allKeys = await getAllKeys(watcher.getConnection(), tx);
  const info = await watcher.parseSettleAuctionNoneLocal(tx, ix, allKeys);
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
  const auction = await watcher.fetchAuction('4bWt4dFtWv9mqhDG8pHj55jui9K2oeQ5e9EJS5frhqcV');

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
    vaaHash: '1d910df52dd6ad9b5e4fe949725b2a0bb37f44aff2247a52793da373adeed269',
    info: {
      configId: 2,
      custodyTokenBump: 255,
      startSlot: '353708574',
      vaaSequence: '30659',
      sourceChain: 10005,
      bestOfferToken: 'RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e',
      initialOfferToken: '8sbHvcQS9MxEUbZoqNz5KqwR4dyjxxeuHAGoUgzNgHxZ',
      amountIn: '10000000',
      securityDeposit: '2550000',
      offerPrice: '1424999',
      redeemerMessageLen: 4,
      destinationAssetInfo: null,
    },
  });
});

test('should fetch auction update from logs', async () => {
  const watcher = new FTSolanaWatcher('Testnet', true);
  const txHash =
    '423vwjxR4c9Gqp55PnYPmyFxwfpqPXaNxACA7VBPgbDhfCg3xcBhggaMvRi8rpRyHmD5HqG1w1SLore9xWy3xBKQ';
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
    fast_vaa_hash: Buffer.from(auctionUpdate.fast_vaa_hash).toString('hex'),
    vaa: auctionUpdate.vaa?.toString(),
    source_chain: auctionUpdate.source_chain,
    target_protocol: {
      Local: {
        program_id: auctionUpdate.target_protocol.Local?.program_id.toString(),
      },
      Cctp: {
        domain: auctionUpdate.target_protocol.Cctp?.domain,
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
    fast_vaa_hash: '1d910df52dd6ad9b5e4fe949725b2a0bb37f44aff2247a52793da373adeed269',
    vaa: 'g45d5m3BMJALpxxqjq9hvEvmVm8Z1MYqLSiww2EZaHH',
    source_chain: 10005,
    target_protocol: {
      Local: {
        program_id: undefined,
      },
      Cctp: {
        domain: 6,
      },
    },
    redeemer_message_len: 4,
    end_slot: '353708579',
    best_offer_token: '8sbHvcQS9MxEUbZoqNz5KqwR4dyjxxeuHAGoUgzNgHxZ',
    token_balance_before: '439813261647616',
    amount_in: '10000000',
    total_deposit: '12550000',
    max_offer_price_allowed: '1424999',
  });
});

// Skipped because it requires database
test.skip('should index all auction history', async () => {
  const watcher = new FTSolanaWatcher('Testnet');
  await watcher.indexAuctionHistory('77W4Votv6bK1tyq4xcvyo2V9gXYknXBwcZ53XErgcEs9');
});
