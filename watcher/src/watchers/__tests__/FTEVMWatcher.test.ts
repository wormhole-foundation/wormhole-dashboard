import { RPCS_BY_CHAIN } from '../../consts';
import { ethers } from 'ethers';
import TokenRouterParser from '../../fastTransfer/tokenRouter/parser';
import FTWatcher from '../FTEVMWatcher';
import SwapLayerParser from '../../fastTransfer/swapLayer/parser';
import path from 'path';
import { readFileSync } from 'fs';

jest.setTimeout(60_000);
class MockJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  getTransactionReceipt = jest.fn();
  getTransaction = jest.fn();
  getBlock = jest.fn();
}

const provider = new ethers.providers.JsonRpcProvider(RPCS_BY_CHAIN['Testnet']['ArbitrumSepolia']);

describe('TokenRouter', () => {
  it('should identify transaction function correctly', async () => {
    const txHash = '0x8fc2759366dedd8134f884d9bdf6a072834942bb4873216941a1bac17d53cfc6';

    const parser = new TokenRouterParser('Testnet', 'ArbitrumSepolia', provider);

    const parsedOrder = await parser.parseFastMarketOrder(txHash);

    expect(parsedOrder).not.toBe(null);
    expect(parsedOrder?.wormhole.sequence).toBe(10436n);
    expect(parsedOrder?.fastMessage?.sequence).toBe(10437n);

    if (!parsedOrder?.wormhole.emitterAddress || !parsedOrder?.fastMessage?.emitterAddress) {
      throw new Error('Emitter address is null');
    }

    // We only care about the vaa hashes so we can ignore other data in the parsedOrder for now
    const whAddressHex = Buffer.from(parsedOrder?.wormhole.emitterAddress).toString('hex');
    const ftAddressHex = Buffer.from(parsedOrder?.fastMessage.emitterAddress).toString('hex');
    expect(whAddressHex).toBe('000000000000000000000000e0418c44f06b0b0d7d1706e01706316dbb0b210e');
    expect(ftAddressHex).toBe('000000000000000000000000e0418c44f06b0b0d7d1706e01706316dbb0b210e');
  });

  it('should get transactions in range', async () => {
    const parser = new TokenRouterParser('Testnet', 'ArbitrumSepolia', provider);

    const results = await parser.getFTResultsInRange(49505590, 49505594);

    expect(results).not.toBe(null);
    expect(results?.results.length).toBe(1);
    expect(results?.results[0]).toStrictEqual({
      fast_vaa_id: '10003/000000000000000000000000e0418c44f06b0b0d7d1706e01706316dbb0b210e/12169',
      amount_in: 10000000n,
      min_amount_out: 0n,
      src_chain: 10003,
      dst_chain: 1,
      sender: '000000000000000000000000b028e6fe28743e4e0db2884a6fc81ff0c6461847',
      redeemer: 'b2621b860cfa5d7f324e06771e4ef1d7f12e9dddf30026d282a78e520625b571',
      market_order_tx_hash: '0x9a2f04c57a18ab8a75a34f766d89543c7f0b218d8d8ac6fb2c49b808a1e54f57',
      market_order_timestamp: new Date('2024-05-30T14:38:13.000Z'),
    });
  });

  // for local testing
  it.skip('should save fast transfers in range', async () => {
    const watcher = new FTWatcher('Testnet', 'ArbitrumSepolia');

    await watcher.getFtMessagesForBlocks(49505590, 49505594);
  });
});

const swapLayerAddress = '0xdA11B3bc8705D84BEae4a796035bDcCc9b59d1ee';

describe('SwapLayerParser', () => {
  let parser: SwapLayerParser;
  let mockProvider: MockJsonRpcProvider;

  beforeEach(() => {
    mockProvider = new MockJsonRpcProvider();
    parser = new SwapLayerParser(mockProvider, swapLayerAddress, null, 'ArbitrumSepolia');
  });

  it('should parse a swap layer transaction correctly', async () => {
    // Mock the provider methods with real transaction and receipt data
    // Mock getTransactionReceipt
    mockProvider.getTransactionReceipt.mockImplementation(() => {
      const mockDataPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'mock',
        'rpc.ankr.com',
        'arbitrum_sepolia',
        `receipt_${txHash}.json`
      );
      return Promise.resolve(JSON.parse(readFileSync(mockDataPath, 'utf-8')));
    });

    // Mock getTransaction
    mockProvider.getTransaction.mockImplementation(() => {
      const mockDataPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'mock',
        'rpc.ankr.com',
        'arbitrum_sepolia',
        `transaction_${txHash}.json`
      );
      return Promise.resolve(JSON.parse(readFileSync(mockDataPath, 'utf-8')));
    });

    const mockBlock = { timestamp: Math.floor(Date.now() / 1000) };
    jest.spyOn(provider, 'getBlock').mockResolvedValue(mockBlock as any);

    // Load the expected result from a mock file
    const txHash = '0x8e61395ff443d67697fdafad62403dca90f2ffb0181e141b0c1ed52090873d13';

    const result = await parser.parseSwapLayerTransaction(txHash, mockBlock.timestamp);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      tx_hash: '0x8e61395ff443d67697fdafad62403dca90f2ffb0181e141b0c1ed52090873d13',
      recipient: '0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC',
      output_token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      output_amount: BigInt('20000000000'),
      relaying_fee: BigInt('10447500'),
      redeem_time: new Date(mockBlock.timestamp * 1000),
      fill_id: '1/cb0406e59555bf0371b7c4fff1812a11a8d92dad02ad422062971d61dcce2cd0/2',
    });
  });
});
