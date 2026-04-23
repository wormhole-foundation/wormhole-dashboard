/**
 * Backfill the `missingVaas` collection by fetching from a running `missing-vaas`
 * endpoint and writing the results into Firestore. Idempotent — uses set().
 *
 * Usage:
 *   npx ts-node scripts/backfillMissingVaas.ts
 *
 * Environment (via .env):
 *   FIRESTORE_ACCOUNT_KEY_PATH
 *   FIRESTORE_MISSING_VAAS_COLLECTION
 *   MISSING_VAAS_URL    e.g. https://<region>-<project>.cloudfunctions.net/missing-vaas
 */

import * as dotenv from 'dotenv';
dotenv.config();

import {
  FIRESTORE_BATCH_LIMIT,
  ObservedMessage,
  assertEnvironmentVariable,
  chunkArray,
  toFirestoreDocId,
} from '@wormhole-foundation/wormhole-monitor-common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type MissDoc = {
  chainId: number;
  block: number;
  emitter: string;
  seq: string;
  txHash: string;
  timestamp: string;
};

type MissingVaasResponse = {
  [chainId: string]: {
    messages: ObservedMessage[];
    lastRowKey: string;
    lastUpdated: number;
  };
};

async function main() {
  const url = assertEnvironmentVariable('MISSING_VAAS_URL');
  const missingCollection = assertEnvironmentVariable('FIRESTORE_MISSING_VAAS_COLLECTION');

  const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
  initializeApp({ credential: cert(serviceAccount) });
  const firestore = getFirestore();

  console.log(`fetching ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as MissingVaasResponse;

  const ops: { docId: string; data: MissDoc }[] = [];
  for (const entry of Object.values(data)) {
    for (const m of entry.messages) {
      ops.push({
        docId: toFirestoreDocId(m.id),
        data: {
          chainId: m.chain,
          block: m.block,
          emitter: m.emitter,
          seq: m.seq,
          txHash: m.txHash ?? '',
          timestamp: m.timestamp ?? '',
        },
      });
    }
  }
  console.log(`received ${ops.length} miss records`);

  const collection = firestore.collection(missingCollection);
  for (const chunk of chunkArray(ops, FIRESTORE_BATCH_LIMIT)) {
    const batch = firestore.batch();
    for (const op of chunk) {
      batch.set(collection.doc(op.docId), op.data);
    }
    await batch.commit();
    console.log(`wrote batch of ${chunk.length}`);
  }
  console.log('backfill complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
