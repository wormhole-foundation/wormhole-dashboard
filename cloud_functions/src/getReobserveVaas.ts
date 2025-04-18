import { chainToChainId } from '@wormhole-foundation/sdk-base';
import {
  assertEnvironmentVariable,
  getNetwork,
  isVAASigned,
  ReobserveInfo,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

const MAX_VAAS_TO_REOBSERVE = 25;

export async function getReobserveVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  const API_KEY = assertEnvironmentVariable('REOBSERVE_VAA_API_KEY');
  if (!req || !req.body || !req.body.apiKey || req.body.apiKey !== API_KEY) {
    res.status(400).send('Missing or Invalid API key');
    return;
  }
  let reobsMap: Map<string, ReobserveInfo> = new Map<string, ReobserveInfo>();
  try {
    reobsMap = await getAndProcessReobsVAAs();
  } catch (e) {
    console.log('could not get missing VAAs', e);
    res.sendStatus(500);
  }

  const vaaArray = Array.from(reobsMap.values());
  // Need to flatten the array of arrays before returning
  const retVal = vaaArray.flat();
  res.status(200).send(JSON.stringify(retVal));
  return;
}

async function getAndProcessReobsVAAs(): Promise<Map<string, ReobserveInfo>> {
  console.log('getAndProcessReobsVAAs');
  // Get VAAs in the firestore holding area.
  const firestore = new Firestore();
  const collectionName = assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION');
  const collectionRef = firestore.collection(collectionName).doc('Reobserve');
  let current = new Map<string, ReobserveInfo>();
  let putBack: ReobserveInfo[] = [];
  let vaas: ReobserveInfo[] = [];
  let realVaas: ReobserveInfo[] = [];

  try {
    const res = await firestore.runTransaction(async (t) => {
      const doc = await t.get(collectionRef);
      if (!doc.exists) {
        console.log('Reobserve document does not exist!');
        return current;
      }
      const data = doc.data();
      if (data) {
        if (data.VAAs.length > MAX_VAAS_TO_REOBSERVE) {
          putBack = data.VAAs.slice(MAX_VAAS_TO_REOBSERVE);
        }
        vaas = data.VAAs.slice(0, MAX_VAAS_TO_REOBSERVE);
        console.log('number of reobserved VAAs', vaas.length);
        const MAX_SOLANA_VAAS_TO_REOBSERVE = 2;
        // Can only process 2 Solana VAAs at a time due to rpc rate limits
        // So we put the rest back in the collection
        let solanaCount = 0;
        for (const vaa of vaas) {
          if (vaa.chain === chainToChainId('Solana')) {
            solanaCount++;
            if (solanaCount > MAX_SOLANA_VAAS_TO_REOBSERVE) {
              putBack.push(vaa);
              continue;
            }
          }
          realVaas.push(vaa);
        }
        console.log('number of real VAAs', realVaas.length);
      }
      t.update(collectionRef, { VAAs: putBack });
    });
  } catch (e) {
    console.error('error getting reobserved VAAs', e);
    return current;
  }
  for (const vaa of realVaas) {
    if (!(await isVAASigned(getNetwork(), vaa.vaaKey))) {
      current.set(vaa.txhash, vaa);
    }
  }
  console.log('number of reobservable VAAs that are not signed', current.size);
  return current;
}
