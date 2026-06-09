/**
 * Diagnostic: dump the current state of TVL metadata cache entries for
 * Sui (21) and Aptos (22). Read-only.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=<key.json>
 *   export FIRESTORE_TVL_METADATA_COLLECTION=<collection-name>
 *   npx tsx scripts/inspect-tvl-metadata.ts
 */

import { Firestore } from 'firebase-admin/firestore';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

const TARGET_CHAINS = [21, 22];

async function main() {
  const collectionName = assertEnvironmentVariable('FIRESTORE_TVL_METADATA_COLLECTION');
  const firestore = new Firestore();
  const collection = firestore.collection(collectionName);

  for (const chain of TARGET_CHAINS) {
    const all = await collection.where('token_chain', '==', chain).get();
    const resolved = all.docs.filter((d) => d.data().resolved === true);
    const unresolved = all.docs.filter((d) => d.data().resolved === false);
    const newest = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
      docs.reduce<number>((acc, d) => Math.max(acc, Number(d.data().updatedAt || 0)), 0);
    const oldest = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
      docs.reduce<number>(
        (acc, d) => Math.min(acc, Number(d.data().updatedAt || Date.now())),
        Date.now()
      );

    console.log(`\n--- chain ${chain} ---`);
    console.log(`total docs: ${all.size}`);
    console.log(`resolved:   ${resolved.length}`);
    console.log(`unresolved: ${unresolved.length}`);
    if (resolved.length > 0) {
      console.log(
        `resolved updatedAt range: ${new Date(oldest(resolved)).toISOString()} .. ${new Date(
          newest(resolved)
        ).toISOString()}`
      );
    }
    if (unresolved.length > 0) {
      console.log(
        `unresolved updatedAt range: ${new Date(oldest(unresolved)).toISOString()} .. ${new Date(
          newest(unresolved)
        ).toISOString()}`
      );
    }
    console.log('\nfirst 3 resolved:');
    for (const doc of resolved.slice(0, 3)) {
      const d = doc.data();
      console.log(
        `  ${doc.id}: native=${d.native_address} cg_id=${d.coin_gecko_coin_id} symbol=${d.symbol} decimals=${d.decimals}`
      );
    }
    console.log('first 3 unresolved:');
    for (const doc of unresolved.slice(0, 3)) {
      const d = doc.data();
      console.log(
        `  ${doc.id}: native=${d.native_address} cg_id=${d.coin_gecko_coin_id} updatedAt=${new Date(
          Number(d.updatedAt)
        ).toISOString()}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
