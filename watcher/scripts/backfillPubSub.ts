import { PubSub } from '@google-cloud/pubsub';
import { sleep } from '@wormhole-foundation/wormhole-monitor-common/src/utils';
import * as dotenv from 'dotenv';
import ora from 'ora';
import { makeSignedVAAsRowKey } from '../src/databases/utils';
dotenv.config();

// This script publishes the VAA keys below to the signed-vaa PubSub topic so they can be picked up by the processVaa cloud function
// These need to be in the signedVAAs row padded format (you can use makeSignedVAAsRowKey)
const vaaKeys = [
  '30/0000000000000000000000008d2de8d2f73f1f4cab472ac9a881c9b123c79627/106',
  '30/0000000000000000000000008d2de8d2f73f1f4cab472ac9a881c9b123c79627/107',
].map((key) => {
  const [chain, emitter, seq] = key.split('/');
  return makeSignedVAAsRowKey(parseInt(chain), emitter, seq);
});

(async () => {
  const pubsub = new PubSub();
  const topic = pubsub.topic(`signed-vaa`);
  let count = 0;
  const logMsg = () => `Publishing VAA keys to PubSub ${topic.name}: ${count}/${vaaKeys.length}`;
  let log = ora(logMsg()).start();
  try {
    for (const vaaKey of vaaKeys) {
      await topic.publishMessage({ data: Buffer.from(vaaKey) });
      count++;
      log.text = logMsg();
      await sleep(1000);
    }
    log.succeed(`Published ${count} VAAs`);
  } catch (e) {
    log.fail('An error occurred while publishing.');
    console.error(e);
  }
})();
