import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { writeFileSync } from 'fs';
import ora from 'ora';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { makeVaaId, parseMessageId } from '../src/databases/utils';
import { AXIOS_CONFIG_JSON } from '../src/consts';
import { parseVaa } from '@certusone/wormhole-sdk';

// This script checks for messages which don't have VAAs and attempts to fetch the VAAs from the guardians
// This is useful for cases where the VAA doesn't exist in bigtable (perhaps due to an outage) but is available
// Found messages should be backfilled with https://github.com/wormhole-foundation/bigtable-backfill-guardian-rpc for completions sake
// Missing message should be re-observed by the guardians
// TODO: At some point this all should be automated in the watcher to self-heal the db

const foundVaas: { [id: string]: string } = {};
const missingVaas: { [id: string]: string | undefined } = {};

const GUARDIAN_RPCS = [
  'https://wormhole-v2-mainnet-api.certus.one',
  'https://wormhole.inotel.ro',
  'https://wormhole-v2-mainnet-api.mcf.rocks',
  'https://wormhole-v2-mainnet-api.chainlayer.network',
  'https://wormhole-v2-mainnet-api.staking.fund',
];

(async () => {
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    let log = ora('Fetching messages without a signed VAA...').start();
    const missingVaaMessages = await bt.fetchMissingVaaMessages();
    log.succeed();
    const total = missingVaaMessages.length;
    let found = 0;
    let search = 0;
    let tooNew = 0;
    log = ora(`Searching for VAA...`).start();
    for (const observedMessage of missingVaaMessages) {
      log.text = `Searching for VAA ${++search}/${total}...`;
      const { chain, emitter, sequence } = parseMessageId(observedMessage.id);
      const id = makeVaaId(chain, emitter, sequence);
      let vaaBytes: string | null = null;
      for (const rpc of GUARDIAN_RPCS) {
        log.text = `Searching for VAA ${search}/${total} (${rpc})...`;
        try {
          const result = await axios.get(
            `${rpc}/v1/signed_vaa/${chain}/${emitter}/${sequence.toString()}`,
            AXIOS_CONFIG_JSON
          );
          if (result.data.vaaBytes) {
            vaaBytes = result.data.vaaBytes;
            break;
          }
        } catch (e) {}
      }
      if (vaaBytes) {
        found++;
        const signedVAA = Buffer.from(vaaBytes, 'base64');
        const vaa = parseVaa(signedVAA);
        const vaaTime = vaa.timestamp;
        if (now - vaaTime > 3600) {
          // More than one hour old.
          foundVaas[id] = Buffer.from(vaaBytes, 'base64').toString('hex');
        } else {
          tooNew++;
        }
      } else {
        missingVaas[id] = observedMessage.data.info.txHash?.[0].value;
      }
    }
    log.succeed();
    console.log('Total:', total);
    console.log('Found:', found);
    console.log('Too New:', tooNew);
    console.log('Missing:', total - found);
    writeFileSync('./found.json', JSON.stringify(foundVaas, undefined, 2));
    writeFileSync('./missing.json', JSON.stringify(missingVaas, undefined, 2));
  } catch (e) {
    console.error(e);
  }
})();
