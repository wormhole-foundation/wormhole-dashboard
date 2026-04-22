import { Firestore } from 'firebase-admin/firestore';

const CACHE_TTL_MS = 15 * 1000;

let cache: { data: any[]; expiresAt: number } | undefined;

export async function getGuardianHeartbeats(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const now = Date.now();
    let heartbeats: any[];
    if (cache && now < cache.expiresAt) {
      heartbeats = cache.data;
      console.log('using cached data');
    } else {
      const firestore = new Firestore();
      const snap = await firestore.collection('heartbeats').get();
      heartbeats = snap.docs.map((d) => d.data());
      cache = { data: heartbeats, expiresAt: now + CACHE_TTL_MS };
      console.log('refreshed cache');
    }
    // Match the Go implementation: marshal an empty result as null, not [].
    res.status(200).json({ heartbeats: heartbeats.length === 0 ? null : heartbeats });
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e));
  }
}
