import { ChainId, Network, toChainId } from '@wormhole-foundation/sdk-base';
import {
  explorerBlock,
  explorerTx,
  getMissThreshold,
  getNetwork,
} from '@wormhole-foundation/wormhole-monitor-common';
import { chainIdToName } from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';
import { MissingVaasByChain, commonGetMissingVaas } from './getMissingVaas';
import { ObservedMessage, ReobserveInfo, SlackInfo } from './types';
import { assertEnvironmentVariable, formatAndSendToSlack, isVAASigned } from './utils';

interface EnqueuedVAAResponse {
  sequence: string;
  releaseTime: number;
  notionalValue: string;
  txHash: string;
}

interface Emitter {
  emitterAddress: string;
  enqueuedVaas: EnqueuedVAAResponse[];
  totalEnqueuedVaas: string;
}

interface ChainStatus {
  availableNotional: string;
  chainId: number;
  emitters: Emitter[];
}

interface GovernedVAA {
  chainId: number;
  emitterAddress: string;
  sequence: string;
  txHash: string;
}

// The key is the vaaKey
type GovernedVAAMap = Map<string, GovernedVAA>;

const network: Network = getNetwork();

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

  const alarmSlackInfo: SlackInfo = {
    channelId: assertEnvironmentVariable('MISSING_VAA_SLACK_CHANNEL_ID'),
    postUrl: assertEnvironmentVariable('MISSING_VAA_SLACK_POST_URL'),
    botToken: assertEnvironmentVariable('MISSING_VAA_SLACK_BOT_TOKEN'),
    bannerTxt: 'Wormhole Missing VAA Alarm',
    msg: '',
  };

  let firestoreVAAs: FirestoreVAA[] = [];
  let reobsMap: Map<string, ReobserveInfo> = new Map<string, ReobserveInfo>();
  try {
    // Get the current VAAs in the firestore holding area that we want to keep there.
    // The key is the vaaKey
    let firestoreMap: Map<string, FirestoreVAA> = await getAndProcessFirestore();

    // Pre fill out firestoreVAAS with the VAAs we know we want to keep.
    firestoreMap.forEach((vaa) => {
      firestoreVAAs.push(vaa);
    });
    reobsMap = await getAndProcessReobsVAAs();

    // Get governed VAAS
    const governedVAAs: GovernedVAAMap = await getGovernedVaas();
    console.log('number of governed VAAs', governedVAAs.size);

    // Get reference times
    const refTimes: LatestTimeByChain = await getLastBlockTimeFromFirestore();

    // Alarm any watchers that are behind by more than 24 hours
    await alarmOldBlockTimes(refTimes);

    // attempting to retrieve missing VAAs...
    const messages: MissingVaasByChain = await commonGetMissingVaas();
    if (messages) {
      const now = new Date();
      for (const chain of Object.keys(messages)) {
        const chainId: ChainId = toChainId(Number(chain));
        const msgs = messages[chainId];
        if (msgs && msgs.messages) {
          for (let i = 0; i < msgs.messages.length; i++) {
            // Check the timestamp and only send messages that are older than MISS_THRESHOLD_IN_MINS
            const msg: ObservedMessage = msgs.messages[i];
            // If there is a reference time for this chain, use it.  Otherwise, use the current time.
            let timeToCheck = getMissThreshold(now, chainId);
            if (refTimes[chainId]) {
              let refTime = refTimes[chainId]?.latestTime;
              if (refTime) {
                const refDateTime = new Date(refTime);
                timeToCheck = getMissThreshold(refDateTime, chainId);
              }
            }
            if (msg.timestamp < timeToCheck) {
              let vaaKey: string = `${msg.chain}/${msg.emitter}/${msg.seq}`;
              if (firestoreMap.has(vaaKey)) {
                console.log(`skipping over ${vaaKey} because it is already in firestore`);
                continue;
              }
              if (governedVAAs.has(vaaKey)) {
                console.log(`skipping over ${vaaKey} because it is governed`);
                continue;
              }
              if (await isVAASigned(getNetwork(), vaaKey)) {
                console.log(`skipping over ${vaaKey} because it is signed`);
                continue;
              }
              let firestoreMsg: FirestoreVAA = convert(msg);
              firestoreMap.set(vaaKey, firestoreMsg);
              firestoreVAAs.push(firestoreMsg);
              reobsMap.set(msg.txHash, {
                chain: msg.chain,
                txhash: msg.txHash,
                vaaKey: vaaKey,
              });
              if (network === 'Mainnet') {
                alarmSlackInfo.msg = formatMessage(msg);
                await formatAndSendToSlack(alarmSlackInfo);
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
  let reobs: ReobserveInfo[] = [];
  reobsMap.forEach((vaa) => {
    reobs.push(vaa);
  });
  await updateFirestore(firestoreVAAs, reobs);
  res.status(200).send('successfully alarmed missing VAAS');
  return;
}

// This function gets all the enqueued VAAs from the governorStatus collection.
async function getGovernedVaas(): Promise<GovernedVAAMap> {
  const vaas: GovernedVAAMap = new Map<string, GovernedVAA>();
  // Walk all the guardians and retrieve the enqueued VAAs
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_GOVERNOR_STATUS_COLLECTION')
  );
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data) {
      // data should be a ChainStatus[]
      const chains: ChainStatus[] = data.chains;
      chains.forEach((chain) => {
        // chain should be a ChainStatus
        const emitters: Emitter[] = chain.emitters;
        emitters.forEach((emitter) => {
          // Filter 0x off the front of the emitter address
          if (emitter.emitterAddress.startsWith('0x')) {
            emitter.emitterAddress = emitter.emitterAddress.slice(2);
          }
          // emitter should be an Emitter
          const enqueuedVaas: EnqueuedVAAResponse[] = emitter.enqueuedVaas;
          enqueuedVaas.forEach((vaa) => {
            // vaa should be an EnqueuedVAAResponse
            const governedVAA: GovernedVAA = {
              chainId: chain.chainId,
              emitterAddress: emitter.emitterAddress,
              sequence: vaa.sequence,
              txHash: vaa.txHash,
            };
            const key = `${chain.chainId}/${emitter.emitterAddress}/${vaa.sequence}`;
            vaas.set(key, governedVAA);
          });
        });
      });
    }
  }
  return vaas;
}

// This function gets all the VAAs in the firestore table,
// checks the timestamp (keeping any that are less than the thresholdold),
// and returns a map of those VAAs.
async function getAndProcessFirestore(): Promise<Map<string, FirestoreVAA>> {
  // Get VAAs in the firestore holding area.
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  let current = new Map<string, FirestoreVAA>();
  const now = new Date();
  await collection
    .doc('VAAs')
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          // if VAA < missThreshold old, leave in firestore
          const vaas: FirestoreVAA[] = data.VAAs;
          vaas.forEach((vaa) => {
            // vaa.chain is guaranteed to be a string representation of a number e.g. "34"
            if (vaa.noticedTS > getMissThreshold(now, toChainId(Number(vaa.chain)))) {
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

async function getAndProcessReobsVAAs(): Promise<Map<string, ReobserveInfo>> {
  // Get VAAs in the firestore holding area.
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  let current = new Map<string, ReobserveInfo>();
  await collection
    .doc('Reobserve')
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          const vaas: ReobserveInfo[] = data.VAAs;
          vaas.forEach(async (vaa) => {
            if (!(await isVAASigned(getNetwork(), vaa.vaaKey))) {
              console.log('keeping reobserved VAA in firestore', vaa.vaaKey);
              current.set(vaa.txhash, vaa);
            } else {
              console.log('pruning reobserved VAA in firestore because it is signed. ', vaa.vaaKey);
            }
          });
          console.log('number of reobserved VAAs', vaas.length);
        }
      }
    })
    .catch((error) => {
      console.error('Error getting Reobserve document:', error);
    });
  return current;
}

async function updateFirestore(missing: FirestoreVAA[], reobserv: ReobserveInfo[]): Promise<void> {
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  const doc = collection.doc('VAAs');
  await doc.set({ VAAs: missing });
  const reobserveDoc = collection.doc('Reobserve');
  await reobserveDoc.set({ VAAs: reobserv });
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
  const cName: string = chainIdToName(msg.chain);
  const vaaKeyUrl: string = `https://wormholescan.io/#/tx/${msg.chain}/${msg.emitter}/${msg.seq}`;
  const txHashUrl: string = explorerTx(network, toChainId(msg.chain), msg.txHash);
  const blockUrl: string = explorerBlock(network, toChainId(msg.chain), msg.block.toString());
  const formattedMsg = `*Chain:* ${cName}(${msg.chain})\n*TxHash:* <${txHashUrl}|${msg.txHash}>\n*VAA Key:* <${vaaKeyUrl}|${msg.chain}/${msg.emitter}/${msg.seq}> \n*Block:* <${blockUrl}|${msg.block}> \n*Timestamp:* ${msg.timestamp}`;
  return formattedMsg;
}

async function getLastBlockTimeFromFirestore(): Promise<LatestTimeByChain> {
  // Get latest observed times from firestore.latestObservedBlocks
  const firestore = new Firestore();
  const collectionRef = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION')
  );
  let values: LatestTimeByChain = {};
  try {
    const snapshot = await collectionRef.get();
    snapshot.docs
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((doc) => {
        values[toChainId(Number(doc.id))] = { latestTime: doc.data().lastBlockKey.split('/')[1] };
      });
  } catch (e) {
    console.error(e);
  }
  return values;
}

async function alarmOldBlockTimes(latestTimes: LatestTimeByChain): Promise<void> {
  const alarmSlackInfo: SlackInfo = {
    channelId: assertEnvironmentVariable('MISSING_VAA_SLACK_CHANNEL_ID'),
    postUrl: assertEnvironmentVariable('MISSING_VAA_SLACK_POST_URL'),
    botToken: assertEnvironmentVariable('MISSING_VAA_SLACK_BOT_TOKEN'),
    bannerTxt: 'Wormhole Missing VAA Alarm',
    msg: '',
  };

  let alarmsToStore: AlarmedChainTime[] = [];
  // Read in the already alarmed chains.
  const alarmedChains: Map<ChainId, AlarmedChainTime> = await getAlarmedChainsFromFirestore();
  if (alarmedChains && alarmedChains.size > 0) {
    alarmsToStore = [...alarmedChains.values()];
  } else {
    console.log('no alarmed chains found in firestore');
  }
  // Walk all chains and check the latest block time.
  const now = new Date();
  for (const chain of Object.keys(latestTimes)) {
    const chainId: ChainId = toChainId(Number(chain));
    const latestTime: string | undefined = latestTimes[chainId]?.latestTime;
    if (!latestTime) {
      continue;
    }
    // console.log(`Checking chain ${chainId} with latest time ${latestTime}`);
    const thePast = new Date();
    // Alarm if the chain is behind by more than 24 hours.
    thePast.setHours(thePast.getHours() - 24);
    const oneDayAgo = thePast.toISOString();
    if (latestTime < oneDayAgo && !alarmedChains.has(chainId)) {
      // Send a message to slack
      const chainTime: Date = new Date(latestTime);
      const cName: string = chainIdToName(chainId);
      const deltaTime: number = (now.getTime() - chainTime.getTime()) / (1000 * 60 * 60 * 24);
      alarmSlackInfo.msg = `*Chain:* ${cName}(${chainId})\nThe ${network} watcher is behind by ${deltaTime} days.`;
      await formatAndSendToSlack(alarmSlackInfo);
      alarmsToStore.push({ chain: chainId, alarmTime: now.toISOString() });
    }
  }
  // Save this info so that we don't keep alarming it.
  await storeAlarmedChains(alarmsToStore);
}

async function getAlarmedChainsFromFirestore(): Promise<Map<ChainId, AlarmedChainTime>> {
  // Get VAAs in the firestore holding area.
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION')
  );
  let current = new Map<ChainId, AlarmedChainTime>();
  const now = new Date();
  const thePast = now;
  thePast.setHours(now.getHours() - 24);
  const twentyFourHoursAgo = thePast.toISOString();
  await collection
    .doc('ChainTimes')
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          // if alarmTime < 24 hours old, leave in firestore
          const times: AlarmedChainTime[] = data.times;
          if (times) {
            times.forEach((time) => {
              if (time.alarmTime > twentyFourHoursAgo) {
                console.log('keeping alarmed chain in firestore', time.chain);
                current.set(time.chain, time);
              } else {
                console.log('removing alarmed chain from firestore', time.chain);
              }
            });
          }
        }
      }
    })
    .catch((error) => {
      console.log('Error getting document:', error);
    });
  return current;
}

async function storeAlarmedChains(alarms: AlarmedChainTime[]): Promise<void> {
  const firestore = new Firestore();
  const alarmedChains = firestore
    .collection(assertEnvironmentVariable('FIRESTORE_ALARM_MISSING_VAAS_COLLECTION'))
    .doc('ChainTimes');
  await alarmedChains.set({ times: alarms });
}

type FirestoreVAA = {
  chain: string;
  txHash: string;
  vaaKey: string;
  block: string;
  blockTS: string;
  noticedTS: string;
};

type AlarmedChainTime = {
  chain: ChainId;
  alarmTime: string;
};

type LatestTimeByChain = {
  [chain in ChainId]?: { latestTime: string };
};
