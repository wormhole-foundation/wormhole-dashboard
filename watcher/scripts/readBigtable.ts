import * as dotenv from 'dotenv';
dotenv.config();
import { CHAINS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';

(async () => {
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }
  const instance = bt.bigtable.instance(bt.instanceId);
  const table = instance.table(bt.tableId);
  //   const row = await table
  //     .row('6/10000697/0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052/0')
  //     .get();
  //   console.log(JSON.stringify(row));
  try {
    for (const [chainName, chainId] of Object.entries(CHAINS)) {
      const prefix = `${padUint16(chainId.toString())}/`;
      const observedMessages = await table.getRows({ prefix });
      // for (const msg of observedMessages[0]) {
      //   console.log(chainName.padEnd(12), msg.id);
      // }
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
