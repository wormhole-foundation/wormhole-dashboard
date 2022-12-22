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

  async storeLatestBlock(chain: ChainName, lastBlock: string): Promise<void> {
    if (this.firestoreDb === undefined) {
      this.logger.error('no firestore db set');
      return;
    }
    const chainId = coalesceChainId(chain);
    const lastestCollectionName = assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION');
    this.logger.info(`storing last block=${lastBlock} for chain=${chainId}`);
    const lastOservedBlock = this.firestoreDb
      .collection(lastestCollectionName)
      .doc(`${chainId.toString()}`);
    await lastOservedBlock.set({ lastBlock } || {});
  }

  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    if (!this.collectionName) {
      this.logger.warn('no firestore collection set');
      return;
    }
    if (this.firestoreDb === undefined) {
      this.logger.warn('no firestore db set');
      return;
    }
    const chainId = coalesceChainId(chain);
    this.db[chainId] = { ...(this.db[chainId] || {}), ...vaasByBlock };
    const observedBlock = this.firestoreDb
      .collection(this.collectionName)
      .doc(`${chainId.toString()}`);
    await observedBlock.set(this.db[chainId] || {});

    let lastBlock = undefined;
    if (vaasByBlock) {
      const blockInfos = Object.keys(vaasByBlock);
      if (blockInfos.length) {
        lastBlock = blockInfos[blockInfos.length - 1].split('/')[0];
      }
    }
    if (lastBlock !== undefined) {
      await this.storeLatestBlock(chain, lastBlock);
    }
  }

  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    if (this.firestoreDb === undefined) {
      this.logger.warn('no firestore db set');
      return null;
    }
    const lastestCollectionName = assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION');

    const chainId = coalesceChainId(chain);
    const lastObservedBlock = this.firestoreDb
      .collection(lastestCollectionName)
      .doc(chainId.toString());
    const lastObservedBlockByChain = await lastObservedBlock.get();
    const vaasByBlock = lastObservedBlockByChain.data() || {};
    if (vaasByBlock) {
      this.logger.info(
        `for chain=${chain}, found most recent firestore block=${vaasByBlock?.lastBlock}`
      );
      return vaasByBlock?.lastBlock;
    }
    return null;
  }
}
