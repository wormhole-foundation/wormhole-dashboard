import { ChainId } from '@wormhole-foundation/sdk-base';
import {
  ObservedMessage,
  fromFirestoreDocId,
  isChainDeprecated,
  parseMessageId,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';

export type MissingVaasByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastRowKey: string;
    lastUpdated: number;
  };
};

const CACHE_TTL_MS = 60 * 1000;

let cache: { data: MissingVaasByChain; expiresAt: number } | undefined;

export async function getMissingVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  try {
    const now = Date.now();
    let data: MissingVaasByChain;
    if (cache && now < cache.expiresAt) {
      data = cache.data;
    } else {
      data = await commonGetMissingVaas();
      cache = { data, expiresAt: now + CACHE_TTL_MS };
    }
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}

export async function commonGetMissingVaas(): Promise<MissingVaasByChain> {
  const firestore = new Firestore();
  const collection = firestore.collection(
    process.env.FIRESTORE_MISSING_VAAS_COLLECTION || 'missingVaas'
  );
  const snapshot = await collection.get();
  const now = Date.now();
  const result: MissingVaasByChain = {};
  for (const doc of snapshot.docs) {
    const data = doc.data() as {
      chainId: number;
      block: number;
      emitter: string;
      seq: string;
      txHash: string;
      timestamp: string;
    };
    if (isChainDeprecated(data.chainId)) continue;
    const id = fromFirestoreDocId(doc.id);
    const { chain, block, emitter, sequence } = parseMessageId(id);
    const message: ObservedMessage = {
      id,
      chain,
      block,
      emitter,
      seq: sequence.toString(),
      timestamp: data.timestamp,
      txHash: data.txHash,
      hasSignedVaa: 0,
    };
    const chainKey = data.chainId as ChainId;
    if (!result[chainKey]) {
      result[chainKey] = { messages: [], lastRowKey: '', lastUpdated: now };
    }
    result[chainKey]!.messages.push(message);
  }
  // Sort each chain's messages by block descending so the dashboard shows newest first.
  for (const entry of Object.values(result)) {
    if (!entry) continue;
    entry.messages.sort((a, b) => b.block - a.block);
  }
  return result;
}
