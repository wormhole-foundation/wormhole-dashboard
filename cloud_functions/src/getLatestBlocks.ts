import { Firestore } from 'firebase-admin/firestore';
import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { assertEnvironmentVariable } from './utils';

export type BlocksByChain = {
  [chain in ChainId]?: {
    lastBlockKey: string;
  };
};

async function getLatestBlocks_() {
  const firestoreCollection = assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION');
  let messages: BlocksByChain = {};
  const firestoreDb = new Firestore({
    // projectId: assertEnvironmentVariable('PROJECT_ID'),
    // timestampsInSnapshots: true,
    // NOTE: Don't hardcode your project credentials here.
    // If you have to, export the following to your shell:
    //   GOOGLE_APPLICATION_CREDENTIALS=<path>
    // keyFilename: assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'),
  });
  try {
    const collectionRef = firestoreDb.collection(firestoreCollection);
    const snapshot = await collectionRef.get();
    snapshot.docs
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((doc) => {
        messages[Number(doc.id) as ChainId] = doc.data().lastBlockKey;
      });
  } catch (e) {
    console.error(e);
  }
  return messages;
}

let cache = { messages: {} as BlocksByChain, lastUpdated: Date.now() };
// default refresh interval = 60 sec
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 60 * 1;

export async function getLatestBlocks(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  let messages: BlocksByChain = {};
  try {
    if (
      Object.keys(cache['messages']).length === 0 ||
      Date.now() - cache['lastUpdated'] > REFRESH_TIME_INTERVAL
    ) {
      if (Object.keys(cache['messages']).length === 0) {
        console.log(`cache is empty, setting cache['messages] ${new Date()}`);
      } else {
        console.log(`cache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`);
      }
      let prevDate = Date.now();
      messages = await getLatestBlocks_();
      let timeDiff = Date.now() - prevDate;
      console.log('After getMessageCounts_=', timeDiff);
      cache['messages'] = messages;
      cache['lastUpdated'] = Date.now();
    } else {
      console.log(`cache is still valid, not refreshing ${new Date()}`);
      messages = cache['messages'];
    }
    res.status(200).send(JSON.stringify(messages));
  } catch (e) {
    res.sendStatus(500);
  }
}
