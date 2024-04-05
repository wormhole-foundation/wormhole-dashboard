import * as dotenv from 'dotenv';
dotenv.config();

import { SolanaWatcher } from '../src/watchers/SolanaWatcher';
import { getNetwork } from '@wormhole-foundation/wormhole-monitor-common';
import { Network } from '@wormhole-foundation/sdk-base';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const network: Network = getNetwork();
  const sw = new SolanaWatcher(network);
  const msgs = await sw.getMessagesForBlocks(245230133, 245230333);
  console.log(msgs);
})();
