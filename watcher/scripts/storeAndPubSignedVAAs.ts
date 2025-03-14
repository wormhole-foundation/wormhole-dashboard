import * as dotenv from 'dotenv';
dotenv.config();
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common/src/utils';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import ora from 'ora';
import { makeSignedVAAsRowKey } from '../src/databases/utils';
import { ChainId } from '@wormhole-foundation/sdk-base';
import { getSignedVAA } from '../src/utils/getSignedVAA';

// This script writes all VAAs from a csv file compatible with the guardian `sign-existing-vaas-csv` admin command to bigtable
// This script will:
// - Read a file containing VAAIds of missing VAAs in the format of `chainId/emitter/sequence`
// - It will call fetch the VAAs from the guardians
// - It will write the VAAs to the bigtable
// - It will publish the VAA keys to the signed-vaa PubSub topic

const CHUNK_SIZE = 10000;

interface SignedVAAsRowDefault {
  key: string;
  data: {
    info: {
      bytes: { value: Buffer; timestamp: '0' };
    };
  };
}

(async () => {
  try {
    const vaaIdFilename = assertEnvironmentVariable('VAA_ID_FILE');

    const bt = new BigtableDatabase();
    if (!bt.bigtable) {
      throw new Error('bigtable is undefined');
    }
    const fileStream = createReadStream(vaaIdFilename, { encoding: 'utf8' });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    let rows: SignedVAAsRowDefault[] = [];
    let log = ora('Getting VAAs from wormholescan...').start();
    for await (const vaaId of rl) {
      log.text = `Getting VAA ${vaaId} from guardians...`;
      const [chainIdStr, emitter, sequence] = vaaId.split('/');
      const chainId = parseInt(chainIdStr);
      // Fetch the VAA from the guardians
      const vaa = await getSignedVAA(chainId, emitter, sequence);
      if (!vaa) {
        console.error(`Failed to get VAA for ${vaaId}`);
        continue;
      }
      const rowKey = makeSignedVAAsRowKey(chainId, emitter, sequence);
      rows.push({
        key: rowKey,
        data: {
          info: {
            bytes: { value: vaa, timestamp: '0' },
          },
        },
      });
    }
    log.succeed(`Retrieved ${rows.length} VAAs`);
    // Next, write the VAAs to the bigtable
    log = ora(`Writing ${rows.length} VAAs to bigtable...`).start();
    await bt.storeSignedVAAs(rows);
    log.succeed(`Wrote ${rows.length} VAAs to bigtable`);
    log = ora(`Publishing ${rows.length} VAAs to to the signed-vaa topic...`).start();
    // Finally, publish the VAA keys to the signed-vaa PubSub topic
    await bt.publishSignedVAAs(rows.map((r) => r.key));
    log.succeed(`Published ${rows.length} VAAs to to the signed-vaa topic...`);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
