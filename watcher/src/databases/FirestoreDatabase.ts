import { Chain, chainToChainId } from '@wormhole-foundation/sdk-base';
import {
  FIRESTORE_BATCH_LIMIT,
  Mode,
  assertEnvironmentVariable,
  chunkArray,
  sleep,
  toFirestoreDocId,
  fromFirestoreDocId,
} from '@wormhole-foundation/wormhole-monitor-common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getSignedVAA } from '../utils/getSignedVAA';
import { Database } from './Database';
import { VaasByBlock } from './types';
import { makeMessageId, makeSignedVAAsRowKey, parseMessageId } from './utils';

const WATCH_MISSING_TIMEOUT = 2 * 60 * 1000;

type MissingVaaDoc = {
  chainId: number;
  block: number;
  emitter: string;
  seq: string;
  txHash: string;
  timestamp: string;
};

type SignedVaaDoc = {
  bytes: Buffer;
  chainId: number;
  chainEmitter: string;
  day: string;
  txHash: string;
  sequence: string;
  timestamp: string;
};

export class FirestoreDatabase extends Database {
  firestoreDb: FirebaseFirestore.Firestore;
  latestCollectionName: string;
  missingVaasCollectionName: string;
  signedVAAsCollectionName: string;
  collectionNameByMode: { [key in Mode]: string };

  constructor() {
    super();
    this.latestCollectionName = assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION');
    this.missingVaasCollectionName = assertEnvironmentVariable('FIRESTORE_MISSING_VAAS_COLLECTION');
    this.signedVAAsCollectionName = assertEnvironmentVariable('FIRESTORE_SIGNED_VAAS_COLLECTION');
    this.collectionNameByMode = {
      vaa: this.latestCollectionName,
    };
    try {
      const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      this.firestoreDb = getFirestore();
    } catch (e) {
      this.logger.error(e);
      throw new Error('Could not load firestore db');
    }
  }

  async getLastBlockByChain(chain: Chain, mode: Mode): Promise<string | null> {
    const chainId = chainToChainId(chain);
    const collectionName = this.collectionNameByMode[mode];
    if (!collectionName) {
      throw new Error(`Unknown mode: ${mode}`);
    }
    const lastObservedBlock = this.firestoreDb.collection(collectionName).doc(chainId.toString());
    const lastObservedBlockByChain = await lastObservedBlock.get();
    const blockKeyData = lastObservedBlockByChain.data();
    const lastBlockKey = blockKeyData?.lastBlockKey;
    if (lastBlockKey) {
      this.logger.info(`for chain=${chain}, found most recent firestore block=${lastBlockKey}`);
      const tokens = lastBlockKey.split('/');
      return chain === 'Aptos' ? tokens.at(-1) : tokens[0];
    }
    return null;
  }

  async storeLatestBlock(chain: Chain, lastBlockKey: string, mode: Mode): Promise<void> {
    if (this.firestoreDb === undefined) {
      this.logger.error('no firestore db set');
      return;
    }
    const chainId = chainToChainId(chain);
    this.logger.info(`storing last block=${lastBlockKey} for chain=${chainId}`);
    const collectionName = this.collectionNameByMode[mode];
    if (!collectionName) {
      throw new Error(`Unknown mode: ${mode}`);
    }
    const lastObservedBlock = this.firestoreDb.collection(collectionName).doc(chainId.toString());
    await lastObservedBlock.set({ lastBlockKey });
  }

  async storeVaasByBlock(
    chain: Chain,
    vaasByBlock: VaasByBlock,
    updateLatestBlock: boolean = true
  ): Promise<void> {
    const chainId = chainToChainId(chain);
    const filteredBlocks = Database.filterEmptyBlocks(vaasByBlock);
    const missingVaasCollection = this.firestoreDb.collection(this.missingVaasCollectionName);

    type WriteOp = { docId: string; data: MissingVaaDoc };
    const ops: WriteOp[] = [];

    Object.keys(filteredBlocks).forEach((blockKey) => {
      const [block, timestamp] = blockKey.split('/');
      filteredBlocks[blockKey].forEach((msgKey) => {
        const [txHash, vaaKey] = msgKey.split(':');
        const [, emitter, seq] = vaaKey.split('/');
        const messageKey = makeMessageId(chainId, block, emitter, seq);
        ops.push({
          docId: toFirestoreDocId(messageKey),
          data: {
            chainId,
            block: Number(block),
            emitter,
            seq,
            txHash,
            timestamp,
          },
        });
      });
    });

    const chunks = chunkArray(ops, FIRESTORE_BATCH_LIMIT);
    for (const chunk of chunks) {
      const batch = this.firestoreDb.batch();
      for (const op of chunk) {
        batch.set(missingVaasCollection.doc(op.docId), op.data);
      }
      await batch.commit();
    }

    if (updateLatestBlock) {
      const blockKeys = Object.keys(vaasByBlock).sort(
        (bk1, bk2) => Number(bk1.split('/')[0]) - Number(bk2.split('/')[0])
      );
      if (blockKeys.length) {
        const lastBlockKey = blockKeys[blockKeys.length - 1];
        this.logger.info(`for chain=${chain}, storing last firestore block=${lastBlockKey}`);
        await this.storeLatestBlock(chain, lastBlockKey, 'vaa');
      }
    }
  }

  async fetchMissingVaas(): Promise<Array<{ messageId: string; doc: MissingVaaDoc }>> {
    const collection = this.firestoreDb.collection(this.missingVaasCollectionName);
    const snapshot = await collection.get();
    return snapshot.docs.map((doc) => ({
      messageId: fromFirestoreDocId(doc.id),
      doc: doc.data() as MissingVaaDoc,
    }));
  }

  async watchMissing(): Promise<void> {
    while (true) {
      try {
        const missing = await this.fetchMissingVaas();
        const total = missing.length;
        this.logger.info(`locating signed VAAs for ${total} missing messages`);

        const resolved: Array<{
          messageId: string;
          vaaKey: string;
          bytes: Buffer;
          source: MissingVaaDoc;
        }> = [];
        for (const { messageId, doc } of missing) {
          const { chain, emitter, sequence } = parseMessageId(messageId);
          const seq = sequence.toString();
          const vaaBytes = await getSignedVAA(chain, emitter, seq);
          if (vaaBytes) {
            const vaaKey = makeSignedVAAsRowKey(chain, emitter, seq);
            resolved.push({ messageId, vaaKey, bytes: vaaBytes, source: doc });
          }
        }

        if (resolved.length > 0) {
          await this.archiveSignedVAAs(resolved);
          await this.deleteMissingVaas(resolved.map((r) => r.messageId));
          this.logger.info(`archived and cleared ${resolved.length} resolved VAAs`);
        }
        this.logger.info(
          `processed ${total} missing, resolved ${resolved.length}, outstanding ${
            total - resolved.length
          }`
        );
      } catch (e) {
        this.logger.error(e);
      }
      await sleep(WATCH_MISSING_TIMEOUT);
    }
  }

  async archiveSignedVAAs(
    rows: Array<{ vaaKey: string; bytes: Buffer; source: MissingVaaDoc }>
  ): Promise<void> {
    const collection = this.firestoreDb.collection(this.signedVAAsCollectionName);
    const chunks = chunkArray(rows, FIRESTORE_BATCH_LIMIT);
    for (const chunk of chunks) {
      const batch = this.firestoreDb.batch();
      for (const row of chunk) {
        const docId = toFirestoreDocId(row.vaaKey);
        const day = toDayString(row.source.timestamp);
        const doc: SignedVaaDoc = {
          bytes: row.bytes,
          chainId: row.source.chainId,
          chainEmitter: `${row.source.chainId}/${row.source.emitter}`,
          day,
          txHash: row.source.txHash,
          sequence: row.source.seq,
          timestamp: row.source.timestamp,
        };
        batch.set(collection.doc(docId), doc);
      }
      await batch.commit();
      this.logger.info(
        `wrote ${chunk.length} signed VAAs to the ${this.signedVAAsCollectionName} collection`
      );
    }
  }

  async deleteMissingVaas(messageIds: string[]): Promise<void> {
    const collection = this.firestoreDb.collection(this.missingVaasCollectionName);
    const chunks = chunkArray(messageIds, FIRESTORE_BATCH_LIMIT);
    for (const chunk of chunks) {
      const batch = this.firestoreDb.batch();
      for (const id of chunk) {
        batch.delete(collection.doc(toFirestoreDocId(id)));
      }
      await batch.commit();
    }
  }
}

function toDayString(timestamp: string): string {
  const ts = Number(timestamp);
  const ms = Number.isFinite(ts) ? (ts < 1e12 ? ts * 1000 : ts) : Date.parse(timestamp);
  const d = new Date(Number.isFinite(ms) ? ms : Date.now());
  return d.toISOString().slice(0, 10);
}
