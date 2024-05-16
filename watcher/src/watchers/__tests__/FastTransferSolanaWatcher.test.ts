import { jest, test, expect } from '@jest/globals';
import { FastTransferSolanaWatcher } from '../FastTransferSolanaWatcher';

jest.setTimeout(360_000);

// This test is working, but testing it is not very useful since the return value is just the lastBlockKey.
// It is just an entrypoint to test the whole thing with a local postgres database.
test.skip('getMessagesByBlock', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet');
  await watcher.getMessagesByBlock(299513411, 300551112);
});

test('placeInitialOfferCctp', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);

  const txHash =
    '622s4otqmig2LB6AjnhvQv4gwBpUX9Ewnnh2XKa7YfsRhr4h1AU1GJRweii4C9rwqNzX1piMQ3jZQTMTv7aS4pyE';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];

  const parsedLogs = await watcher.parseInstruction(tx, ix, 1);

  expect(parsedLogs?.fast_transfer).toEqual({
    fast_transfer_id: '10003/000000000000000000000000e0418c44f06b0b0d7d1706e01706316dbb0b210e/643',
    fast_vaa_hash: 'd59b2b7c01853524165f92524193af7a1c812277bf1898c00843fee64f9b4839',
    auction_pubkey: '77W4Votv6bK1tyq4xcvyo2V9gXYknXBwcZ53XErgcEs9',
    amount: 10000000n,
    initial_offer_time: new Date('2024-05-22T06:05:10.000Z'),
    src_chain: 10003,
    dst_chain: 1,
    sender: '0x000000000000000000000000b028e6fe28743e4e0db2884a6fc81ff0c6461847',
    redeemer: '0xb2621b860cfa5d7f324e06771e4ef1d7f12e9dddf30026d282a78e520625b571',
    start_slot: 300551112n,
    end_slot: 300551117n,
    deadline_slot: 300551127n,
    best_offer_amount: 1500000n,
    best_offer_token: 'tomvTppiaT5T56Gm5gTegXnSEEf4tVBCz99VkcvYcT8',
    message_protocol: 'local',
    cctp_domain: undefined,
    local_program_id: 'tD8RmtdcV7bzBeuFgyrFc8wvayj988ChccEzRQzo6md',
    tx_hash:
      '622s4otqmig2LB6AjnhvQv4gwBpUX9Ewnnh2XKa7YfsRhr4h1AU1GJRweii4C9rwqNzX1piMQ3jZQTMTv7aS4pyE',
    timestamp: new Date('2024-05-22T06:05:16.000Z'),
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
  const watcher = new FastTransferSolanaWatcher('Testnet', true);

  const txHash =
    '5jD1at1xF6KKj5BzCuNZEhfNpEU4ho19pkdccm9xvtxs2AhYN1F1WNMj7uGtkkr4SrzT3DPzdZbEKMP6u5FVLzLy';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[1];

  const message = await watcher.parseInstruction(tx, ix, 1);

  expect(message?.fast_transfer).toEqual(null);
  expect(message?.auction_offer).toEqual({
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
test.skip('should parse executeFastOrderLocal', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);
  const txHash =
    'wKDEbC56KnUFkbPgmnyxPRxwfZpAJ2vBLxeZif9VQWrWgLj1AByEBsDMdJm7rTeVmhiBGcB6PsGfmxKDcP978r9';

  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[0];

  const info = await watcher.parseExecuteFastOrderLocal(tx, ix);
  expect(info).toEqual({
    status: 'executed',
    penalty: 0n,
    user_amount: 8000000n,
    execution_payer: 'gyVfT39y3tWQnfXwxY6Hj7ZeLFN2K8Z6heWEJ4zxYRB',
    execution_slot: 294811396n,
    execution_time: new Date('2024-04-26T14:38:17.000Z'),
    execution_tx_hash: txHash,
  });
});

test.skip('should parse executeFastOrderCctp', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);
  const txHash =
    'oGtHH2x7hLapWkRnBVE9iUqEPJ5UbAjgTYHxDgfPLQru1mQBDYFWyuA1b2NEvRgXvper8KK55MMs3GUYmvhtP4h';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[2];

  const info = await watcher.parseExecuteFastOrderCctp(tx, ix);
  expect(info).toEqual({
    status: 'executed',
    user_amount: 8000000n,
    penalty: 0n,
    execution_tx_hash: txHash,
    execution_payer: 'RiCKPaEpYYR2M8eGeUfRp43Yj63xfoAmkpeeNG3Mso7',
    execution_slot: 293282685n,
    execution_time: new Date('2024-04-18T17:53:10.000Z'),
  });
});

test.skip('should parse settleAuctionComplete', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);
  const txHash =
    '59LKdrZ4cdHq9hnyZttxP1ZkbYGNNbMpUFM8A68UCtk8qE9y4eUkMm9bkxbwj7WM6i29YxfJ3pb19EUYC2SXCVmp';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[3];

  const info = await watcher.parseSettleAuctionComplete(tx, ix, 3);
  expect(info).toEqual({
    id: {
      auction_pubkey: 'FS4EAzWA2WuMKyGBy2C7EBvHL9W63NDX9JR4CPveAiDK',
    },
    info: {
      repayment: 10000000n,
      settle_payer: '9FPvGxE1cNVTrDgHhSdYi2i12HFiepeqNM9Q1kEXgiX2',
      settle_slot: 298315989n,
      settle_time: new Date('2024-05-12T06:15:56.000Z'),
      settle_tx_hash:
        '59LKdrZ4cdHq9hnyZttxP1ZkbYGNNbMpUFM8A68UCtk8qE9y4eUkMm9bkxbwj7WM6i29YxfJ3pb19EUYC2SXCVmp',
      status: 'settled',
    },
  });
});
