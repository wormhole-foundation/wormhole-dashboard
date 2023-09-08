import { CHAIN_ID_TO_NAME, ChainId, ChainName } from '@certusone/wormhole-sdk';
import { MissingVaasByChain, commonGetMissingVaas } from './getMissingVaas';
import { assertEnvironmentVariable, formatAndSendToSlack } from './utils';
import { ObservedMessage } from './types';
import { explorerBlock, explorerTx } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

export async function alarmMissingVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  let firestoreVAAs: FirestoreVAA[] = [];
  try {
    // Get the current VAAs in the firestore holding area that we want to keep there.
    // The key is the vaaKey
    let firestoreMap: Map<string, FirestoreVAA> = await getAndProcessFirestore();

    // Pre fill out firestoreVAAS with the VAAs we know we want to keep.
    firestoreMap.forEach((vaa) => {
      firestoreVAAs.push(vaa);
    });

    // attempting to retrieve missing VAAs...
    const messages: MissingVaasByChain = await commonGetMissingVaas();
    if (messages) {
      const now = new Date();
      const thePast = now;
      thePast.setHours(now.getHours() - 2);
      const twoHoursAgo = thePast.toISOString();
      for (const chain of Object.keys(messages)) {
        const chainId = chain as unknown as ChainId;
        const msgs = messages[chainId];
        if (msgs && msgs.messages) {
          for (let i = 0; i < msgs.messages.length; i++) {
            // Check the timestamp and only send messages that are older than 2 hours
            const msg: ObservedMessage = msgs.messages[i];
            if (msg.timestamp < twoHoursAgo) {
              let vaaKey: string = `${msg.chain}/${msg.emitter}/${msg.seq}`;
              if (!firestoreMap.has(vaaKey)) {
                let firestoreMsg: FirestoreVAA = convert(msg);
                firestoreMap.set(vaaKey, firestoreMsg);
                firestoreVAAs.push(firestoreMsg);
                await formatAndSendToSlack(formatMessage(msg));
              }
            }
          }
        } else {
          console.log('skipping over messages for chain', chainId);
        }
      }
    }
  } catch (e) {
    console.log('could not get missing VAAs', e);
    res.sendStatus(500);
  }
  await updateFirestore(firestoreVAAs);
  res.status(200).send('successfully alarmed missing VAAS');
  return;
}

// This function gets all the VAAs in the firestore table,
// checks the timestamp (keeping any that are less than 2 hours old),
// and returns a map of those VAAs.
async function getAndProcessFirestore(): Promise<Map<string, FirestoreVAA>> {
  // Get VAAs in the firestore holding area.
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  let current = new Map<string, FirestoreVAA>();
  const now = new Date();
  const thePast = now;
  thePast.setHours(now.getHours() - 2);
  const twoHoursAgo = thePast.toISOString();
  await collection
    .doc('VAAs')
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          // if VAA < 2 hours old, leave in firestore
          const vaas: FirestoreVAA[] = data.VAAs;
          vaas.forEach((vaa) => {
            if (vaa.noticedTS > twoHoursAgo) {
              // console.log('keeping VAA in firestore', vaa.vaaKey);
              current.set(vaa.vaaKey, vaa);
            }
          });
        }
      }
    })
    .catch((error) => {
      console.log('Error getting document:', error);
    });
  return current;
}

async function updateFirestore(vaas: FirestoreVAA[]): Promise<void> {
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  const doc = collection.doc('VAAs');
  await doc.set({ VAAs: vaas });
}

function convert(msg: ObservedMessage): FirestoreVAA {
  return {
    chain: msg.chain.toString(),
    txHash: msg.txHash,
    vaaKey: `${msg.chain}/${msg.emitter}/${msg.seq}`,
    block: msg.block.toString(),
    blockTS: msg.timestamp,
    noticedTS: new Date().toISOString(),
  };
}

function formatMessage(msg: ObservedMessage): string {
  const cName: string = CHAIN_ID_TO_NAME[msg.chain as ChainId] as ChainName;
  // const vaaKeyUrl: string = `https://wormhole.com/explorer/?emitterChain=${msg.chain}&emitterAddress=${msg.emitter}&sequence=${msg.seq}`;
  const vaaKeyUrl: string = `https://wormholescan.io/#/tx/${msg.chain}/${msg.emitter}/${msg.seq}`;
  const txHashUrl: string = explorerTx(msg.chain as ChainId, msg.txHash);
  const blockUrl: string = explorerBlock(msg.chain as ChainId, msg.block.toString());
  const formattedMsg = `*Chain:* ${cName}(${msg.chain})\n*TxHash:* <${txHashUrl}|${msg.txHash}>\n*VAA Key:* <${vaaKeyUrl}|${msg.chain}/${msg.emitter}/${msg.seq}> \n*Block:* <${blockUrl}|${msg.block}> \n*Timestamp:* ${msg.timestamp}`;
  return formattedMsg;
}

type FirestoreVAA = {
  chain: string;
  txHash: string;
  vaaKey: string;
  block: string;
  blockTS: string;
  noticedTS: string;
};
