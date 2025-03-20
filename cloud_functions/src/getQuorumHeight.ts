import {
  assertEnvironmentVariable,
  STANDBY_GUARDIANS,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

// TODO: pulled from getLastHeartbeats.ts, could be shared.
interface Heartbeat {
  nodeName: string;
  counter: string;
  timestamp: string;
  networks: HeartbeatNetwork[];
  version: string;
  guardianAddr: string;
  bootTimestamp: string;
  features: string[];
  p2pNodeAddr?: string;
}

interface HeartbeatNetwork {
  id: number;
  height: string;
  contractAddress: string;
  errorCount: string;
  safeHeight: string;
  finalizedHeight: string;
}

const isTestnet = assertEnvironmentVariable('NETWORK') === 'TESTNET';

/**
 * Wormhole Foundation requested an additional buffer to increase the likelihood of success in
 * the event that a guardian is tracking a height but not properly handling requests.
 */
const QUORUM_BUFFER = 1;

export function getQuorumCount(numGuardians: number): number {
  return isTestnet ? 1 : Math.floor((numGuardians * 2) / 3 + 1) + QUORUM_BUFFER;
}

async function getHeartbeats_() {
  const heartbeats: Heartbeat[] = [];
  const firestoreDb = new Firestore();
  try {
    const collectionRef = firestoreDb.collection('heartbeats');
    const snapshot = await collectionRef.get();
    snapshot.docs.forEach((doc) => {
      heartbeats.push(doc.data() as Heartbeat);
    });
  } catch (e) {
    console.error(e);
  }
  return heartbeats;
}

let cache = { heartbeats: [] as Heartbeat[], lastUpdated: Date.now() };
// default refresh interval = 15 sec
const REFRESH_TIME_INTERVAL =
  Number(process.env.CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL) || 1000 * 15;

export async function getQuorumHeight(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  const { chainId: chainIdStr } = req.query;
  const chainId = Number(chainIdStr);
  if (Number.isNaN(chainId)) {
    res.status(400).send(`Invalid chainId`);
    return;
  }
  let heartbeats: Heartbeat[] = [];
  try {
    if (cache.heartbeats.length === 0 || Date.now() - cache.lastUpdated > REFRESH_TIME_INTERVAL) {
      if (cache.heartbeats.length === 0) {
        console.log(`cache is empty, setting cache.heartbeats ${new Date()}`);
      } else {
        console.log(`cache is older than ${REFRESH_TIME_INTERVAL} ms, refreshing ${new Date()}`);
      }
      let prevDate = Date.now();
      heartbeats = await getHeartbeats_();
      let timeDiff = Date.now() - prevDate;
      console.log('After getHeartbeats_=', timeDiff);
      cache.heartbeats = heartbeats;
      cache.lastUpdated = Date.now();
    } else {
      console.log(`cache is still valid, not refreshing ${new Date()}`);
      heartbeats = cache.heartbeats;
    }
    if (heartbeats.length) {
      const latestHeights: bigint[] = [];
      const safeHeights: bigint[] = [];
      const finalizedHeights: bigint[] = [];
      for (const heartbeat of heartbeats) {
        // filter out standby guardians
        if (
          !STANDBY_GUARDIANS.find(
            (g) => g.pubkey.toLowerCase() === heartbeat.guardianAddr.toLowerCase()
          )
        ) {
          const network = heartbeat.networks.find((n) => n.id === chainId);
          latestHeights.push(BigInt(network?.height || '0'));
          safeHeights.push(BigInt(network?.safeHeight || '0'));
          finalizedHeights.push(BigInt(network?.finalizedHeight || '0'));
        }
      }
      latestHeights.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
      safeHeights.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
      finalizedHeights.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
      const quorumIdx = Math.min(
        getQuorumCount(latestHeights.length) - 1,
        latestHeights.length - 1
      );
      res.status(200).send(
        JSON.stringify({
          latest: latestHeights[quorumIdx].toString(),
          safe: safeHeights[quorumIdx].toString(),
          finalized: finalizedHeights[quorumIdx].toString(),
        })
      );
    } else {
      console.log('no heartbeats');
      res.sendStatus(500);
    }
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
}
