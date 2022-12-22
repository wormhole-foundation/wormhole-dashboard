import { ChainId } from '@certusone/wormhole-sdk';
import express from 'express';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import {
  DB_FILE,
  DB_LAST_BLOCK_FILE,
  DB_SOURCE,
  FIRESTORE_ACCOUNT_KEY_PATH,
  FIRESTORE_COLLECTION,
} from './consts';

const app = express();
const port = 4000;
const ENCODING = 'utf8';

export type VaasByBlock = { [blockInfo: string]: string[] };
export type DB = { [chain in ChainId]?: VaasByBlock };
export const loadFirestoreDb = async (): Promise<DB> => {
  let db: DB = {};
  if (!FIRESTORE_ACCOUNT_KEY_PATH) {
    console.log('need service account to use firestore');
    return {};
  }
  if (!FIRESTORE_COLLECTION) {
    console.log('no firestore collection set');
    return {};
  }
  try {
    const serviceAccount = require(FIRESTORE_ACCOUNT_KEY_PATH);

    initializeApp({
      credential: cert(serviceAccount),
    });

    const dbFirestore = getFirestore();
    const observedBlocks = dbFirestore.collection(FIRESTORE_COLLECTION);
    const observedBlocksByChain = await observedBlocks.get();
    observedBlocksByChain.docs.forEach(
      (doc: { id: any; data: () => VaasByBlock | undefined }) =>
        (db[Number(doc.id) as ChainId] = doc.data())
    );
  } catch (e) {
    console.log('Could not load firestore db');
  }
  return {};
};

app.get('/api/db', async (req, res) => {
  let db;
  let lastBlockByChain = {};
  if (DB_SOURCE === 'local') {
    db = JSON.parse(fs.readFileSync(DB_FILE, ENCODING));
    lastBlockByChain = JSON.parse(fs.readFileSync(DB_LAST_BLOCK_FILE, ENCODING));
  } else {
    db = await loadFirestoreDb();
  }
  res.send({ db, lastBlockByChain });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
