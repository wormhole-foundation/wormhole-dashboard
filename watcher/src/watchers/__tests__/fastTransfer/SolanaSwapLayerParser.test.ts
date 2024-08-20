import { SwapLayerParser } from '../../../fastTransfer/swapLayer/solParser';
import {
  Connection,
  ParsedAccountData,
  ParsedTransactionWithMeta,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import path from 'path';
import { readFileSync } from 'fs';
import { TransferCompletion } from '../../../fastTransfer/types';

jest.setTimeout(60_000);

// Mock the Connection class
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getTransaction: jest.fn(),
      getParsedTransaction: jest.fn(),
    })),
  };
});

function mockGetTransaction(network: string = 'devnet') {
  return async (txHash: string) => {
    const mockDataPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'mock',
      `api.${network}.solana.com`,
      `transaction_${txHash}.json`
    );
    const data = JSON.parse(readFileSync(mockDataPath, 'utf-8'));

    // Convert string account keys to PublicKey objects
    if (data.transaction?.message?.accountKeys) {
      data.transaction.message.accountKeys = data.transaction.message.accountKeys.map(
        (key: string) => new PublicKey(key)
      );
    }

    // Convert staticAccountKeys if present
    if (data.transaction?.message?.staticAccountKeys) {
      data.transaction.message.staticAccountKeys = data.transaction.message.staticAccountKeys.map(
        (key: string) => new PublicKey(key)
      );
    }

    data.transaction.message.getAccountKeys = function () {
      return {
        staticAccountKeys: this.staticAccountKeys || this.accountKeys,
        accountKeys: this.accountKeys,
      };
    };

    return data as VersionedTransactionResponse;
  };
}

function mockGetParsedTransaction(network: string = 'devnet') {
  return async (txHash: string) => {
    const mockDataPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'mock',
      `api.${network}.solana.com`,
      `parsedTransaction_${txHash}.json`
    );
    const data = JSON.parse(readFileSync(mockDataPath, 'utf-8'));

    // Convert string pubkeys to PublicKey objects
    if (data.transaction?.message?.accountKeys) {
      data.transaction.message.accountKeys = data.transaction.message.accountKeys.map(
        (account: any) => ({
          ...account,
          pubkey: new PublicKey(account.pubkey),
        })
      );
    }

    // Convert programId in instructions
    if (data.transaction?.message?.instructions) {
      data.transaction.message.instructions = data.transaction.message.instructions.map(
        (instruction: any) => ({
          ...instruction,
          programId: new PublicKey(instruction.programId),
        })
      );
    }
    return data as ParsedTransactionWithMeta;
  };
}

function mockGetParsedAccountInfo(network: string = 'devnet') {
  return async (account: PublicKey) => {
    const mockDataPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'mock',
      `api.${network}.solana.com`,
      `parsedAccountInfo_${account.toBase58()}.json`
    );
    const data = JSON.parse(readFileSync(mockDataPath, 'utf-8'));

    // Convert string pubkeys to PublicKey objects
    if (data.value?.data.parsed?.info?.owner) {
      data.value.data.parsed.info.owner = new PublicKey(data.value.data.parsed.info.owner);
    }

    return data as ParsedAccountData;
  };
}

function seralizedRes(result: TransferCompletion | null) {
  if (!result) throw new Error('result is null');
  return {
    ...result,
    output_amount: result.output_amount.toString(),
    relaying_fee: result.relaying_fee.toString(),
  };
}

describe('SwapLayerParser', () => {
  let parser: SwapLayerParser;
  let connection: Connection;

  beforeEach(() => {
    jest.clearAllMocks();

    connection = new Connection('devnet') as jest.Mocked<Connection>;
    // Mock getTransaction, getParsedTransaction, and getParsedAccountInfo methods
    connection.getTransaction = jest.fn().mockImplementation(mockGetTransaction('devnet'));
    connection.getParsedTransaction = jest
      .fn()
      .mockImplementation(mockGetParsedTransaction('devnet'));
    connection.getParsedAccountInfo = jest
      .fn()
      .mockImplementation(mockGetParsedAccountInfo('devnet'));

    parser = new SwapLayerParser('Devnet', connection);
  });

  test('parseTransaction for complete_transfer_direct', async () => {
    const txHash =
      '32goGrEsPb6Kky65Z4wX6wswzjDbT9pBWs1HSZFsfWhxoA1fnSsoE9hJgtepPL8VyKQJUdRrfGWPrXCizDufArwR';
    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      fill_id: 'BkWHY4H2kEVevdUeiRmFYNtg5zURRbTEtjt29KWdbjzV',
      output_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      recipient: 'FQ4PBuykgHqemPhqqktJL9y1L7oTbShYiwGkwgM1VceF',
      redeem_time: new Date('2024-08-13T21:59:54.000Z'),
      output_amount: '20000000000',
      staged_inbound: undefined,
      tx_hash:
        '32goGrEsPb6Kky65Z4wX6wswzjDbT9pBWs1HSZFsfWhxoA1fnSsoE9hJgtepPL8VyKQJUdRrfGWPrXCizDufArwR',
      relaying_fee: '0',
    };

    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for complete_transfer_relay', async () => {
    const txHash =
      '4EWH6ZetTTjdYSbxqXddKNKLKDpBctELAhqChmkey2jwunZaj1Digj1fQxBMxtw6uhDeqkX3ev2vucu7jrexhWka';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);

    const expected = {
      recipient: 'FQ4PBuykgHqemPhqqktJL9y1L7oTbShYiwGkwgM1VceF',
      tx_hash:
        '4EWH6ZetTTjdYSbxqXddKNKLKDpBctELAhqChmkey2jwunZaj1Digj1fQxBMxtw6uhDeqkX3ev2vucu7jrexhWka',
      relaying_fee: '0',
      fill_id: 'BkWHY4H2kEVevdUeiRmFYNtg5zURRbTEtjt29KWdbjzV',
      output_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      redeem_time: new Date('2024-08-13T21:59:55.000Z'),
      output_amount: '20000000000',
      staged_inbound: undefined,
    };

    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for complete_swap_direct', async () => {
    const txHash =
      '3Ufce773W4xgVsZiGBhSRPQssfaNdrEWeTBPLTnQSFZHsVx9ADaSN9yQBF6kcQMyDAoAnM3BVU88tQ2TbDZn1kUJ';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      recipient: 'GcppBeM1UYGU4b7aX9uPAqL4ZEUThNHt5FpxPtzBE1xx',
      tx_hash:
        '3Ufce773W4xgVsZiGBhSRPQssfaNdrEWeTBPLTnQSFZHsVx9ADaSN9yQBF6kcQMyDAoAnM3BVU88tQ2TbDZn1kUJ',
      relaying_fee: '0',
      fill_id: '9txX9C9wG8RKUWFzjvkqeCPmMVMKpkYD1HStjLYLRvoU',
      output_token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      redeem_time: new Date('2024-08-17T00:16:41.000Z'),
      output_amount: '49564106',
      staged_inbound: undefined,
    };
    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for complete_swap_relay', async () => {
    const txHash =
      '39K8aHVDmyAjne6J4PBFkvmKZH9CQR9QpbmTFafeiTLxeWg5n5RgcRdX5AYhebLR9shiUHrDeqg4YSD1EhRZNpS1';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      fill_id: 'Hru6CBfyXtG18zF33DnXEjmECjgj1eMjNfPRaESBqpUr',
      output_token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      recipient: 'GcppBeM1UYGU4b7aX9uPAqL4ZEUThNHt5FpxPtzBE1xx',
      redeem_time: new Date('2024-08-17T00:16:42.000Z'),
      output_amount: '48508532',
      staged_inbound: undefined,
      tx_hash:
        '39K8aHVDmyAjne6J4PBFkvmKZH9CQR9QpbmTFafeiTLxeWg5n5RgcRdX5AYhebLR9shiUHrDeqg4YSD1EhRZNpS1',
      relaying_fee: '0',
    };
    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for complete_transfer_payload', async () => {
    const txHash =
      'eo2CugBsJ9Efbtg9TAiYyBvvZZsbh93ZZcLDxxjbmbEpZojCF8BDphVVrCjXtMkSLaP2EGQE5zSrjU4r6fxsxRP';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      recipient: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      tx_hash:
        'eo2CugBsJ9Efbtg9TAiYyBvvZZsbh93ZZcLDxxjbmbEpZojCF8BDphVVrCjXtMkSLaP2EGQE5zSrjU4r6fxsxRP',
      relaying_fee: '0',
      fill_id: '8jwioGKqu23fBLMeVdNfMTm41Wnv3TKVKQmA1Ga9518J',
      output_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      redeem_time: new Date('2024-08-13T22:03:21.000Z'),
      output_amount: '0',
      staged_inbound: 'ECiEWJndTfUJaEQ59gYgy6e4331mkrh1USQCmDcBwBvj',
    };
    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for complete_swap_payload', async () => {
    const txHash =
      '4yCcw8MJ1BokhPJM2fQC3BMfoezteM4MkaHLfjPrLG25AEW4EeNxcNsrgU3ECkwQ1sy3AKFseafxM2mfjdwbzo8x';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      fill_id: 'ESccxJbedTgsu7kwK6uNWnMrg3GiD7pgexXfWeyZNK3J',
      output_token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      recipient: 'GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ',
      redeem_time: new Date('2024-08-13T22:04:14.000Z'),
      output_amount: '0',
      staged_inbound: '91AQfKMvRGFrGWscXhD1FQs929P2M28ehAMS75xEVw6f',
      tx_hash:
        '4yCcw8MJ1BokhPJM2fQC3BMfoezteM4MkaHLfjPrLG25AEW4EeNxcNsrgU3ECkwQ1sy3AKFseafxM2mfjdwbzo8x',
      relaying_fee: '0',
    };
    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });

  test('parseTransaction for release_inbound', async () => {
    const txHash =
      '2EFLPdYpdJzeoe4HD4fNRWwphhy9HyEHFj3EQtY9agUPmQ5LjJkXFjEt5dnshS9sSTby9nN2QF9BaCbVyiBFGLxj';

    const result = await parser.parseTransaction(txHash);
    expect(result.length).toBe(1);
    const expected = {
      tx_hash:
        '2EFLPdYpdJzeoe4HD4fNRWwphhy9HyEHFj3EQtY9agUPmQ5LjJkXFjEt5dnshS9sSTby9nN2QF9BaCbVyiBFGLxj',
      relaying_fee: '0',
      fill_id: '',
      output_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      recipient: 'HRTQAZJF7YNogjDUehhVShJxtFdBr8gNWsVJbvL1kvXU',
      redeem_time: new Date('2024-08-15T06:47:19.000Z'),
      output_amount: '6900000000',
      staged_inbound: 'GFJ6699xu2BER8t98S4Vy6ZQam4mvr539AaqvHHBh9i3',
    };
    const serializedRes = seralizedRes(result[0]);
    expect(serializedRes).toEqual(expected);
  });
});
