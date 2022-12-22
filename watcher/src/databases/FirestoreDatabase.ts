import { ChainId, ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
// set up firestore
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertEnvironmentVariable } from '../utils/environment';
import { Database } from './Database';
import { VaasByBlock, DB } from './types';

export class FirestoreDatabase extends Database {
  db: DB;
  collectionName: string;
  firestoreDb: FirebaseFirestore.Firestore | undefined;
  constructor() {
    super();
    this.db = {};
    this.firestoreDb = undefined;
    this.collectionName = assertEnvironmentVariable('FIRESTORE_COLLECTION');
    try {
      const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      this.firestoreDb = getFirestore();
    } catch (e) {
      throw new Error('Could not load firestore db');
    }
  }
  async loadDb(): Promise<DB> {
    if (this.firestoreDb === undefined) {
      this.db = {};
    } else {
      try {
        const observedBlocks = this.firestoreDb.collection(this.collectionName);
        const observedBlocksByChain = await observedBlocks.get();
        observedBlocksByChain.docs.forEach(
          (doc) => (this.db[Number(doc.id) as ChainId] = doc.data())
        );
      } catch (e) {
        this.db = {};
      }
    }
    return this.db;
  }
  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    if (!this.collectionName) {
      console.log('no firestore collection set');
      return null;
    }
    if (this.firestoreDb === undefined) {
      return null;
    }
    const chainId = coalesceChainId(chain);
    const observedBlocks = this.firestoreDb.collection(this.collectionName).doc(chainId.toString());
    const observedBlocksByChain = await observedBlocks.get();
    const vaasByBlock = observedBlocksByChain.data() || {};
    if (vaasByBlock) {
      const blockInfos = Object.keys(vaasByBlock);
      if (blockInfos.length) {
        console.log(
          `for chain=${chain}, found most recent firestore block=${
            blockInfos[blockInfos.length - 1].split('/')[0]
          }`
        );
        return blockInfos[blockInfos.length - 1].split('/')[0];
      }
    }
    return null;
  }
  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    if (!this.collectionName) {
      console.log('no firestore collection set');
      return;
    }
    const chainId = coalesceChainId(chain);
    this.db[chainId] = { ...(this.db[chainId] || {}), ...vaasByBlock };
    const dbFirestore = getFirestore();
    const observedBlock = dbFirestore.collection(this.collectionName).doc(`${chainId.toString()}`);
    await observedBlock.set(this.db[chainId] || {});
  }
}
