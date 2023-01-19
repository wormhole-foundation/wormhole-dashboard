import * as dotenv from 'dotenv';
dotenv.config();
import ora from 'ora';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';

// This script updates the getSignedVaa value for a given list of vaa ids
// This is intended only to be used on messages that already exist in the db
// Populate the message ids with the corresponding id from https://europe-west3-wormhole-315720.cloudfunctions.net/missing-vaas
// The `2` signifies this is a known miss which has been accounted for
// i.e. it was a test attestation / transfer or otherwise resolved

(async () => {
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }

  const messageIds: string[] = [
    '00015/18446744073636435649/148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7/00000000000000000001',
  ];
  try {
    const log = ora(`updating ${messageIds.length} messages`).start();
    await bt.updateMessageStatuses(messageIds, 2);
    log.succeed(`updated ${messageIds.length} messages`);
  } catch (e) {
    console.error(e);
  }
})();
