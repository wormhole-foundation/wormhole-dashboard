import { jest, test } from '@jest/globals';
import { FastTransferSolanaWatcher } from '../FastTransferSolanaWatcher';
import { PublicKey } from '@solana/web3.js';

jest.setTimeout(60_000);

// This test is working, but testing it is not very useful since the return value is just the lastBlockKey.
// It is just an entrypoint to test the whole thing with a local postgres database.
test.skip('getMessagesByBlock', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet');
  await watcher.getMessagesByBlock(291864864, 293957151);
});

test('placeInitialOfferCctp', async () => {
  const watcher = new FastTransferSolanaWatcher('Testnet', true);

  const txHash =
    'nU8xm4jTrHMs1ZJdc6s42DLh2CTSrtNSPPX4EUfzNV98ahpobCVHc8qtd179p7PrFvyg41gViEH3SEtp7bEbeVT';
  const tx = await watcher.getConnection().getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Unable to get transaction');
  }

  const ix = tx.transaction.message.compiledInstructions[3];

  const parsedLogs = await watcher.parseInstruction(
    tx,
    ix,
    new PublicKey('mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS')
  );

  expect(parsedLogs?.fast_transfer).toEqual({
    fast_transfer_id:
      '10003/000000000000000000000000c1cf3501ef0b26c8a47759f738832563c7cb014a/18261',
    fast_vaa_hash: '4216abbd1900293a02ca7d75edfb9ac8486ef787f0f326e0216f434649cafe37',
    auction_pubkey: '7WmzMUnMHcRq4KpHZHwnyrbR3HATUytHv8FcEkLvtmxe',
    amount: 10000000n,
    initial_offer_time: new Date('2024-04-22T21:25:09.000Z'),
    src_chain: 10003,
    dst_chain: 1,
    sender: '000000000000000000000000b028e6fe28743e4e0db2884a6fc81ff0c6461847',
    redeemer: 'b2621b860cfa5d7f324e06771e4ef1d7f12e9dddf30026d282a78e520625b571',
    tx_hash:
      'nU8xm4jTrHMs1ZJdc6s42DLh2CTSrtNSPPX4EUfzNV98ahpobCVHc8qtd179p7PrFvyg41gViEH3SEtp7bEbeVT',
    timestamp: new Date('2024-04-22T21:25:10.000Z'),
  });

  expect(parsedLogs?.auction_offer).toEqual({
    fast_vaa_hash: '4216abbd1900293a02ca7d75edfb9ac8486ef787f0f326e0216f434649cafe37',
    start_slot: 293957151n,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1500000n,
    tx_hash:
      'nU8xm4jTrHMs1ZJdc6s42DLh2CTSrtNSPPX4EUfzNV98ahpobCVHc8qtd179p7PrFvyg41gViEH3SEtp7bEbeVT',
    timestamp: new Date('2024-04-22T21:25:10.000Z'),
  });
});

test('improveOffer', async () => {
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

  const message = await watcher.parseInstruction(
    tx,
    ix,
    new PublicKey('mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS')
  );

  expect(message?.fast_transfer).toEqual(null);
  expect(message?.auction_offer).toEqual({
    fast_vaa_hash: 'd863c96834b4d83003ab941697d43a64261345d77b3b4e8e64dab837a1378671',
    start_slot: 293881579n,
    amount_in: 10000000n,
    security_deposit: 2550000n,
    offer_price: 1425000n,
    tx_hash:
      '5jD1at1xF6KKj5BzCuNZEhfNpEU4ho19pkdccm9xvtxs2AhYN1F1WNMj7uGtkkr4SrzT3DPzdZbEKMP6u5FVLzLy',
    timestamp: new Date('2024-04-22T13:34:12.000Z'),
  });
});
