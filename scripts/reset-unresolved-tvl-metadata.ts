/**
 * One-shot: delete unresolved TVL metadata cache entries for Sui (chain 21)
 * and Aptos (chain 22).
 *
 * After the `normalizeCoinGeckoPlatformAddress` fix in
 * `database/src/coingecko.ts` ships, the `computeTVL` function will resolve
 * Move-style addresses correctly on its next run. Existing firestore cache
 * entries from before the fix have `resolved: false` and would otherwise
 * remain stuck for up to `UNRESOLVED_RETRY_MS` (30 days) from their last
 * attempt. Deleting them lets the next function run re-resolve them
 * immediately.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json>
 *   export FIRESTORE_TVL_METADATA_COLLECTION=<collection-name>
 *   npx tsx scripts/reset-unresolved-tvl-metadata.ts            # dry-run
 *   npx tsx scripts/reset-unresolved-tvl-metadata.ts --apply    # actually delete
 */

import { Firestore } from 'firebase-admin/firestore';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

const TARGET_CHAINS = [21, 22] as const; // Sui, Aptos
const BATCH_LIMIT = 400; // Firestore batched writes cap at 500 ops

async function main() {
  const apply = process.argv.includes('--apply');
  const collectionName = assertEnvironmentVariable('FIRESTORE_TVL_METADATA_COLLECTION');
  const firestore = new Firestore();
  const collection = firestore.collection(collectionName);

  const snap = await collection
    .where('token_chain', 'in', TARGET_CHAINS as unknown as number[])
    .where('resolved', '==', false)
    .get();

  console.log(
    `Found ${snap.size} unresolved metadata entries for chains ${TARGET_CHAINS.join(
      ', '
    )} in '${collectionName}'`
  );

  if (snap.empty) return;

  const sampleIds = snap.docs.slice(0, 5).map((d) => d.id);
  console.log(`Sample doc IDs: ${sampleIds.join(', ')}${snap.size > 5 ? ', ...' : ''}`);

  if (!apply) {
    console.log('Dry-run. Re-run with --apply to delete.');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = firestore.batch();
    const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
    deleted += chunk.length;
    console.log(`Deleted ${deleted}/${snap.size}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
