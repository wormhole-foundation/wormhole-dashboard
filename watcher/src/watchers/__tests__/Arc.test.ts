import { expect, test, describe } from '@jest/globals';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN,
  explorerBlock,
  explorerTx,
} from '@wormhole-foundation/wormhole-monitor-common';
import { chainToChainId, contracts } from '@wormhole-foundation/sdk-base';
import { makeFinalizedVaaWatcher } from '../utils';
import { VAAWatcher } from '../VAAWatcher';
import { RPCS_BY_CHAIN } from '../../consts';

describe('Arc testnet wiring', () => {
  test('SDK resolves the Arc testnet core contract', () => {
    expect(contracts.coreBridge.get('Testnet', 'Arc')).toEqual(
      '0xBB73cB66C26740F31d1FabDC6b7A46a038A300dd'
    );
  });

  test('makeFinalizedVaaWatcher returns a VAAWatcher for Arc', () => {
    const watcher = makeFinalizedVaaWatcher('Testnet', 'Arc');
    expect(watcher).toBeInstanceOf(VAAWatcher);
  });

  test('Arc uses the capped batch size of 10', () => {
    const watcher = makeFinalizedVaaWatcher('Testnet', 'Arc');
    expect(watcher.maximumBatchSize).toEqual(10);
  });

  test('Arc has a testnet RPC fallback configured', () => {
    expect(RPCS_BY_CHAIN['Testnet'].Arc).toEqual('https://rpc.testnet.arc.network');
  });

  test('Arc has an initial deployment block on testnet', () => {
    expect(INITIAL_DEPLOYMENT_BLOCK_BY_NETWORK_AND_CHAIN['Testnet'].Arc).toEqual('46448585');
  });

  test('explorer links point to arcscan testnet', () => {
    const arc = chainToChainId('Arc');
    expect(explorerBlock('Testnet', arc, '46448585')).toEqual(
      'https://testnet.arcscan.app/block/46448585'
    );
    expect(explorerTx('Testnet', arc, '0xabc')).toEqual('https://testnet.arcscan.app/tx/0xabc');
  });
});
