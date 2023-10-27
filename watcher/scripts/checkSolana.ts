import * as dotenv from 'dotenv';
dotenv.config();

import { SolanaWatcher } from '../src/watchers/SolanaWatcher';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const sw = new SolanaWatcher();
  const msgs = await sw.getMessagesForBlocks(245230133, 245230333);
  console.log(msgs);
})();
