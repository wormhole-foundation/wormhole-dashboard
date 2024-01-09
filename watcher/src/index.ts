import * as dotenv from 'dotenv';
dotenv.config();

import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { initDb } from './databases/utils';
import { makeFinalizedWatcher } from './watchers/utils';
import { getNetworkFromEnv } from './utils/environment';

initDb();

const supportedChains: ChainName[] = [
  // 'solana',
  // 'ethereum',
  // 'bsc',
  // 'polygon',
  // 'avalanche',
  // 'oasis',
  // 'algorand',
  // 'fantom',
  // 'karura',
  // 'acala',
  // 'klaytn',
  // 'celo',
  // 'moonbeam',
  // 'arbitrum',
  // 'optimism',
  // 'aptos',
  // 'near',
  'terra2',
  // 'terra',
  // 'xpla',
  // 'injective',
  // 'sui',
  // 'base',
  // 'sei',
  // 'wormchain',
];

const network = getNetworkFromEnv();

for (const chain of supportedChains) {
  makeFinalizedWatcher(network, chain).watch();
}
