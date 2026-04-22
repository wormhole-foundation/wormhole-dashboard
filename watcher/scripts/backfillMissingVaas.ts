/**
 * Backfill the `missingVaas` collection from the existing `messages` collection.
 *
 * Reads docs from `messages` where hasSignedVaa == 0 and seeds corresponding
 * `missingVaas` docs. Idempotent — uses set(). Run once before cutting watcher
 * writes over to the miss-only model.
 *
 * Source (BigTable path): passes --source bigtable to scan the existing BigTable
 * messages table instead. Default is --source firestore.
 *
 * Usage:
 *   npx ts-node scripts/backfillMissingVaas.ts [--source firestore|bigtable]
 *
 * Environment (via .env):
 *   FIRESTORE_ACCOUNT_KEY_PATH
 *   FIRESTORE_MESSAGES_COLLECTION         (default: "messages")
 *   FIRESTORE_MISSING_VAAS_COLLECTION     (default: "missingVaas")
 *   BIGTABLE_INSTANCE_ID, BIGTABLE_TABLE_ID   (only when --source bigtable)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Bigtable } from '@google-cloud/bigtable';
import {
  FIRESTORE_BATCH_LIMIT,
  assertEnvironmentVariable,
  chunkArray,
  fromFirestoreDocId,
  toFirestoreDocId,
} from '@wormhole-foundation/wormhole-monitor-common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseMessageId } from '../src/databases/utils';

type MissDoc = {
  chainId: number;
  block: number;
  emitter: string;
  seq: string;
  txHash: string;
  timestamp: string;
};

function parseArgs(): { source: 'firestore' | 'bigtable' } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--source');
  const source = idx >= 0 ? args[idx + 1] : 'firestore';
  if (source !== 'firestore' && source !== 'bigtable') {
    throw new Error(`invalid --source: ${source}`);
  }
  return { source };
}

function toMissDoc(messageId: string, fields: { timestamp: string; txHash: string }): MissDoc {
  const { chain, block, emitter, sequence } = parseMessageId(messageId);
  return {
    chainId: chain,
    block,
    emitter,
    seq: sequence.toString(),
    txHash: fields.txHash,
    timestamp: fields.timestamp,
  };
}

async function initFirestore() {
  const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function backfillFromFirestore() {
  const firestore = await initFirestore();
  const messagesCollection = process.env.FIRESTORE_MESSAGES_COLLECTION || 'messages';
  const missingCollection = process.env.FIRESTORE_MISSING_VAAS_COLLECTION || 'missingVaas';

  console.log(`scanning ${messagesCollection} for hasSignedVaa == 0...`);
  const snapshot = await firestore
    .collection(messagesCollection)
    .where('hasSignedVaa', '==', 0)
    .get();
  console.log(`found ${snapshot.size} outstanding miss records`);

  const ops = snapshot.docs.map((doc) => {
    const messageId = fromFirestoreDocId(doc.id);
    const data = doc.data() as { timestamp: string; txHash: string };
    return { docId: doc.id, data: toMissDoc(messageId, data) };
  });
  await writeMisses(firestore, missingCollection, ops);
}

async function backfillFromBigtable() {
  const firestore = await initFirestore();
  const missingCollection = process.env.FIRESTORE_MISSING_VAAS_COLLECTION || 'missingVaas';

  const bigtable = new Bigtable();
  const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  const table = instance.table(assertEnvironmentVariable('BIGTABLE_TABLE_ID'));

  console.log('scanning bigtable messages table (this may take a while)...');
  let total = 0;
  let missing = 0;
  let batchOps: { docId: string; data: MissDoc }[] = [];

  const stream = table.createReadStream();
  await new Promise<void>((resolve, reject) => {
    stream
      .on('data', async (row: any) => {
        total++;
        const info = row.data?.info;
        const hasSignedVaa = info?.hasSignedVaa?.[0]?.value;
        if (hasSignedVaa !== 0) return;
        missing++;
        const rowKey = row.id as string;
        const timestamp = info?.timestamp?.[0]?.value ?? '';
        const txHash = info?.txHash?.[0]?.value ?? '';
        batchOps.push({
          docId: toFirestoreDocId(rowKey),
          data: toMissDoc(rowKey, { timestamp, txHash }),
        });
        if (batchOps.length >= 2000) {
          stream.pause();
          try {
            await writeMisses(firestore, missingCollection, batchOps);
            batchOps = [];
          } catch (e) {
            reject(e);
            return;
          }
          stream.resume();
        }
      })
      .on('end', async () => {
        if (batchOps.length) {
          try {
            await writeMisses(firestore, missingCollection, batchOps);
          } catch (e) {
            return reject(e);
          }
        }
        resolve();
      })
      .on('error', reject);
  });
  console.log(`scanned ${total} rows, wrote ${missing} miss records`);
}

async function writeMisses(
  firestore: FirebaseFirestore.Firestore,
  collectionName: string,
  ops: { docId: string; data: MissDoc }[]
) {
  const collection = firestore.collection(collectionName);
  const chunks = chunkArray(ops, FIRESTORE_BATCH_LIMIT);
  for (const chunk of chunks) {
    const batch = firestore.batch();
    for (const op of chunk) {
      batch.set(collection.doc(op.docId), op.data);
    }
    await batch.commit();
    console.log(`wrote batch of ${chunk.length}`);
  }
}

async function main() {
  const { source } = parseArgs();
  if (source === 'firestore') {
    await backfillFromFirestore();
  } else {
    await backfillFromBigtable();
  }
  console.log('backfill complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
