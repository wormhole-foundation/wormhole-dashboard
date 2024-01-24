import * as dotenv from 'dotenv';
dotenv.config();

import { SolanaWatcher } from '../src/watchers/SolanaWatcher';
import { Environment, getEnvironment } from '@wormhole-foundation/wormhole-monitor-common';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const network: Environment = getEnvironment();
  const sw = new SolanaWatcher(network);
  const msgs = await sw.getMessagesForBlocks(245230133, 245230333);
  console.log(msgs);
})();
