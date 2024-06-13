import { RPCS_BY_CHAIN } from '../../consts';
import { ethers } from 'ethers';
import TokenRouterParser from '../../fastTransfer/tokenRouter/parser';
import FTWatcher from '../FTEVMWatcher';

jest.setTimeout(60_000);

const provider = new ethers.providers.JsonRpcProvider(RPCS_BY_CHAIN['Testnet']['ArbitrumSepolia']);

describe('FTWatcher', () => {
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
