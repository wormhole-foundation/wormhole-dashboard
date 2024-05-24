import { jest, test, expect } from '@jest/globals';
import { FastTransferSolanaWatcher } from '../FTSolanaWatcher';

jest.setTimeout(60_000);

// This test is working, but testing it is not very useful since the return value is just the lastBlockKey.
// It is just an entrypoint to test the whole thing with a local postgres database.
test.skip('getMessagesByBlock', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet');
  await watcher.getMessagesByBlock(299707624, 302567900);
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
  const watcher = new FastTransferSolanaWatcher('Testnet', true);
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

  const ix = tx.transaction.message.compiledInstructions[0];

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

test('should parse settleAuctionComplete', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);
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
    id: {
      // in production, we will get this from the based on the `auction_pubkey`
      // in test we cant get it from the db since it is disabled for github CI
      fast_vaa_hash: '',
    },
    info: {
      fast_vaa_hash: '',
      repayment: 1000000n,
      settle_payer: '6H68dreG5qZHUVjBwf4kCGQYmW3hULedbezwzPasTr68',
      settle_slot: 302130744n,
      settle_time: new Date('2024-05-29T08:09:11.000Z'),
      settle_tx_hash:
        '5L2tBfpE35gHBTRmqet4UUGoUJrwYZe6LVCLomVkEDU1TBXNbWW2Xs8pPT5Zz2JQgX2vS8pE4bxmyDEZxL9fBVbs',
      status: 'settled',
    },
  });
});
