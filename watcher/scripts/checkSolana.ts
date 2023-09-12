import * as dotenv from 'dotenv';
dotenv.config();

import { SolanaWatcher } from '../src/watchers/SolanaWatcher';
import { CONFIG } from '@wormhole-foundation/connect-sdk';

// Temporary script to test SolanaWatcher for lookup addresses
(async () => {
  const conf = CONFIG.Testnet.chains.Solana!;
  const sw = new SolanaWatcher(conf.rpc, conf.contracts.coreBridge);
  const msgs = await sw.getMessagesForBlocks(242637719, 242637719);

  console.log(msgs);
})();
