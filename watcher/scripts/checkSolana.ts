import * as dotenv from 'dotenv';
dotenv.config();

import { getNetwork } from '@wormhole-foundation/wormhole-monitor-common';
import { Network } from '@wormhole-foundation/sdk-base';
import { SVMWatcher } from 'src/watchers/SVMWatcher';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const network: Network = getNetwork();
  const sw = new SVMWatcher(network, 'Solana');
  const msgs = await sw.getMessagesForBlocks(245230133, 245230333);
  console.log(msgs);
})();
