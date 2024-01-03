import * as dotenv from 'dotenv';
dotenv.config();

import { SolanaWatcher } from '../src/watchers/SolanaWatcher';
import { getNetworkFromEnv } from '../src/utils/environment';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const network = getNetworkFromEnv();
  const sw = new SolanaWatcher(network);
  const msgs = await sw.getMessagesForBlocks(245230133, 245230333);
  console.log(msgs);
})();
