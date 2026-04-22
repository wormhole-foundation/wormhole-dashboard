/**
 * Migrate all data from BigTable to Firestore.
 *
 * Tables migrated:
 *   1. messages        -> Firestore "messages" collection
 *   2. signedVAAs      -> Firestore "signedVAAs" collection
 *   3. vaasByTxHash    -> Firestore "vaasByTxHash" collection
 *
 * Usage:
 *   npx ts-node scripts/migrateBigtableToFirestore.ts [--table messages|signedVAAs|vaasByTxHash] [--start <rowKey>]
 *
 * Environment variables (via .env):
 *   BIGTABLE_INSTANCE_ID, BIGTABLE_TABLE_ID, BIGTABLE_SIGNED_VAAS_TABLE_ID,
 *   BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID, FIRESTORE_ACCOUNT_KEY_PATH
 *
 * Optional:
 *   FIRESTORE_MESSAGES_COLLECTION       (default: "messages")
 *   FIRESTORE_SIGNED_VAAS_COLLECTION    (default: "signedVAAs")
 *   FIRESTORE_VAAS_BY_TX_HASH_COLLECTION (default: "vaasByTxHash")
 *
 * The script is idempotent — Firestore set() overwrites existing docs.
 * To resume after a failure, pass --start with the last successfully migrated row key
 * (printed to stdout on each batch).
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Bigtable } from '@google-cloud/bigtable';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  assertEnvironmentVariable,
  toFirestoreDocId,
  FIRESTORE_BATCH_LIMIT,
  parseMessageId,
} from '@wormhole-foundation/wormhole-monitor-common';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BT_READ_CHUNK = 5_000; // rows per BigTable getRows call

const bigtable = new Bigtable();
const instanceId = assertEnvironmentVariable('BIGTABLE_INSTANCE_ID');
const instance = bigtable.instance(instanceId);

const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();

const MESSAGES_TABLE_ID = assertEnvironmentVariable('BIGTABLE_TABLE_ID');
const SIGNED_VAAS_TABLE_ID = assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID');
const VAAS_BY_TX_HASH_TABLE_ID = assertEnvironmentVariable('BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID');

const MESSAGES_COLLECTION = process.env.FIRESTORE_MESSAGES_COLLECTION || 'messages';
const SIGNED_VAAS_COLLECTION = process.env.FIRESTORE_SIGNED_VAAS_COLLECTION || 'signedVAAs';
const VAAS_BY_TX_HASH_COLLECTION =
  process.env.FIRESTORE_VAAS_BY_TX_HASH_COLLECTION || 'vaasByTxHash';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WriteOp {
  docId: string;
  data: Record<string, any>;
}

async function writeBatch(collectionName: string, ops: WriteOp[]): Promise<void> {
  const collection = firestore.collection(collectionName);
  for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = firestore.batch();
    for (const op of chunk) {
      batch.set(collection.doc(op.docId), op.data);
    }
    await batch.commit();
  }
}

function elapsed(start: number): string {
  const s = ((Date.now() - start) / 1000).toFixed(1);
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Table-specific migration functions
// ---------------------------------------------------------------------------

async function migrateMessages(startKey: string) {
  const table = instance.table(MESSAGES_TABLE_ID);
  let start = startKey || '';
  let total = 0;
  let skipFirst = !!startKey; // skip the start key itself on resume (already migrated)
  const t0 = Date.now();

  console.log(`[messages] Starting migration from "${start || '(beginning)'}"`);

  while (true) {
    const [rows] = await table.getRows({
      start: start || undefined,
      limit: BT_READ_CHUNK,
    });

    if (rows.length === 0) break;

    const startIdx = skipFirst ? 1 : 0;
    skipFirst = false;
    const batch: WriteOp[] = [];

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const rowKey: string = row.id;
      const info = row.data?.info;

      // Extract chainId from the row key for the denormalized field
      let chainId: number | undefined;
      try {
        const parsed = parseMessageId(rowKey);
        chainId = parsed.chain;
      } catch {
        // If parse fails, extract from the first segment
        chainId = parseInt(rowKey.split('/')[0], 10);
      }

      const data: Record<string, any> = { chainId };
      if (info?.timestamp) {
        data.timestamp = info.timestamp[0]?.value ?? '';
      }
      if (info?.txHash) {
        data.txHash = info.txHash[0]?.value ?? '';
      }
      if (info?.hasSignedVaa) {
        data.hasSignedVaa = info.hasSignedVaa[0]?.value ?? 0;
      }

      batch.push({ docId: toFirestoreDocId(rowKey), data });
    }

    if (batch.length > 0) {
      await writeBatch(MESSAGES_COLLECTION, batch);
      total += batch.length;
      const lastKey = rows[rows.length - 1].id;
      console.log(`[messages] ${total} rows migrated (${elapsed(t0)}) — last key: ${lastKey}`);
    }

    // If we got fewer than the chunk size, we're done
    if (rows.length < BT_READ_CHUNK) break;

    // Next page starts at the last row key
    start = rows[rows.length - 1].id;
    skipFirst = true; // skip the boundary row on the next iteration
  }

  console.log(`[messages] Done — ${total} rows migrated in ${elapsed(t0)}`);
}

async function migrateSignedVAAs(startKey: string) {
  const table = instance.table(SIGNED_VAAS_TABLE_ID);
  let start = startKey || '';
  let total = 0;
  let skipFirst = !!startKey;
  const t0 = Date.now();

  console.log(`[signedVAAs] Starting migration from "${start || '(beginning)'}"`);

  while (true) {
    const [rows] = await table.getRows({
      start: start || undefined,
      limit: BT_READ_CHUNK,
      decode: false, // keep bytes as Buffer
    });

    if (rows.length === 0) break;

    const startIdx = skipFirst ? 1 : 0;
    skipFirst = false;
    const batch: WriteOp[] = [];

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const rowKey: string = row.id;
      const info = row.data?.info;

      const vaaBytes: Buffer | undefined = info?.bytes?.[0]?.value;
      if (!vaaBytes) continue;

      batch.push({
        docId: toFirestoreDocId(rowKey),
        data: { bytes: vaaBytes },
      });
    }

    if (batch.length > 0) {
      await writeBatch(SIGNED_VAAS_COLLECTION, batch);
      total += batch.length;
      const lastKey = rows[rows.length - 1].id;
      console.log(`[signedVAAs] ${total} rows migrated (${elapsed(t0)}) — last key: ${lastKey}`);
    }

    if (rows.length < BT_READ_CHUNK) break;

    start = rows[rows.length - 1].id;
    skipFirst = true;
  }

  console.log(`[signedVAAs] Done — ${total} rows migrated in ${elapsed(t0)}`);
}

async function migrateVaasByTxHash(startKey: string) {
  const table = instance.table(VAAS_BY_TX_HASH_TABLE_ID);
  let start = startKey || '';
  let total = 0;
  let skipFirst = !!startKey;
  const t0 = Date.now();

  console.log(`[vaasByTxHash] Starting migration from "${start || '(beginning)'}"`);

  while (true) {
    const [rows] = await table.getRows({
      start: start || undefined,
      limit: BT_READ_CHUNK,
    });

    if (rows.length === 0) break;

    const startIdx = skipFirst ? 1 : 0;
    skipFirst = false;
    const batch: WriteOp[] = [];

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const rowKey: string = row.id;
      const info = row.data?.info;

      const vaaKeys: string = info?.vaaKeys?.[0]?.value ?? '[]';

      batch.push({
        docId: toFirestoreDocId(rowKey),
        data: { vaaKeys },
      });
    }

    if (batch.length > 0) {
      await writeBatch(VAAS_BY_TX_HASH_COLLECTION, batch);
      total += batch.length;
      const lastKey = rows[rows.length - 1].id;
      console.log(`[vaasByTxHash] ${total} rows migrated (${elapsed(t0)}) — last key: ${lastKey}`);
    }

    if (rows.length < BT_READ_CHUNK) break;

    start = rows[rows.length - 1].id;
    skipFirst = true;
  }

  console.log(`[vaasByTxHash] Done — ${total} rows migrated in ${elapsed(t0)}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let tableFilter: string | null = null;
  let startKey = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--table' && args[i + 1]) {
      tableFilter = args[++i];
    } else if (args[i] === '--start' && args[i + 1]) {
      startKey = args[++i];
    }
  }

  const tables = tableFilter ? [tableFilter] : ['messages', 'signedVAAs', 'vaasByTxHash'];

  for (const table of tables) {
    // Only use the --start key for the first table (or when migrating a single table)
    const key = tables.indexOf(table) === 0 ? startKey : '';
    switch (table) {
      case 'messages':
        await migrateMessages(key);
        break;
      case 'signedVAAs':
        await migrateSignedVAAs(key);
        break;
      case 'vaasByTxHash':
        await migrateVaasByTxHash(key);
        break;
      default:
        console.error(`Unknown table: ${table}. Use messages, signedVAAs, or vaasByTxHash.`);
        process.exit(1);
    }
  }

  console.log('\nMigration complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
