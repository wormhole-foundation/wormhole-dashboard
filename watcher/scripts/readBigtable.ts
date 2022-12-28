import * as dotenv from 'dotenv';
dotenv.config();
import { CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';

// This script provides a summary of the message db

(async () => {
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }
  const instance = bt.bigtable.instance(bt.instanceId);
  const table = instance.table(bt.tableId);
  try {
    for (const [chainName, chainId] of Object.entries(CHAINS)) {
      const prefix = `${padUint16(chainId.toString())}/`;
      const observedMessages = await table.getRows({ prefix });
      console.log(chainName.padEnd(12), observedMessages[0].length.toString().padStart(6));
      if (observedMessages[0][0]) {
        console.log('   id           ', observedMessages[0][0]?.id);
        console.log('   chain        ', parseInt(observedMessages[0][0]?.id.split('/')[0]));
        console.log('   block        ', parseInt(observedMessages[0][0]?.id.split('/')[1]));
        console.log('   emitter      ', observedMessages[0][0]?.id.split('/')[2]);
        console.log('   seq          ', parseInt(observedMessages[0][0]?.id.split('/')[3]));
        console.log('   timestamp    ', observedMessages[0][0]?.data.info.timestamp[0].value);
        console.log('   txHash       ', observedMessages[0][0]?.data.info.txHash[0].value);
        console.log('   hasSignedVaa ', observedMessages[0][0]?.data.info.hasSignedVaa[0].value);
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
