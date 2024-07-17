import { Chain } from '@wormhole-foundation/sdk-base';
import {
  assertEnvironmentVariable,
  GuardianSetInfoByChain,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

export async function getGuardianSetInfo(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  // This goes out to firestore to retrieve the guardian set info
  let info: GuardianSetInfoByChain = {};
  try {
    info = await getGuardianSetInfoByChain();
    res.status(200).send(JSON.stringify(info));
  } catch (e) {
    res.sendStatus(500);
  }
}

async function getGuardianSetInfoByChain(): Promise<GuardianSetInfoByChain> {
  const firestoreCollection = assertEnvironmentVariable('FIRESTORE_GUARDIAN_SET_INFO_COLLECTION');
  let values: GuardianSetInfoByChain = {};
  const firestoreDb = new Firestore({});
  try {
    const collectionRef = firestoreDb.collection(firestoreCollection);
    const snapshot = await collectionRef.get();
    snapshot.docs.forEach((doc) => {
      values[doc.id as Chain] = {
        timestamp: doc.data().timestamp,
        contract: doc.data().contract,
        guardianSet: doc.data().guardianSet,
        guardianSetIndex: doc.data().guardianSetIndex,
      };
    });
  } catch (e) {
    console.error(e);
  }
  return values;
}
