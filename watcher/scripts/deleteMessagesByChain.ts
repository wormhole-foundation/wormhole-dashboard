import * as dotenv from 'dotenv';
dotenv.config();

import { getNetwork, padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { ChainId, chainToChainId, Network, chainIdToChain } from '@wormhole-foundation/sdk-base';

// Script to delete all messages for the chain given by the CHAIN variable below

const CHAIN: ChainId = chainToChainId('Polygon');
const network: Network = getNetwork();

(async () => {
  if (network !== 'Testnet') {
    throw new Error('This script is only intended for Testnet');
  }
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }

  const instance = bt.bigtable.instance(bt.instanceId);
  const messageTable = instance.table(bt.msgTableId);
  await messageTable.deleteRows(`${padUint16(CHAIN.toString())}/`);
  console.log('Deleted all rows starting with', chainIdToChain(CHAIN));
})();
