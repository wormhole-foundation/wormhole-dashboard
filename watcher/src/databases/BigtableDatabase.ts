import { ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { assertEnvironmentVariable } from '../utils/environment';
import { Database } from './Database';
import { Bigtable } from '@google-cloud/bigtable';
import { padUint16, padUint64 } from '@wormhole-foundation/wormhole-monitor-common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { VaasByBlock } from './types';

export class BigtableDatabase extends Database {
  tableId: string;
  instanceId: string;
  bigtable: Bigtable | undefined;
  firestoreDb: FirebaseFirestore.Firestore | undefined;
  latestCollectionName: string;
  constructor() {
    super();
    this.bigtable = undefined;
    this.firestoreDb = undefined;
    // this.firestore = new FirestoreDatabase();
    this.tableId = assertEnvironmentVariable('BIGTABLE_TABLE_ID');
    this.instanceId = assertEnvironmentVariable('BIGTABLE_INSTANCE_ID');
    this.latestCollectionName = assertEnvironmentVariable('FIRESTORE_LATEST_COLLECTION');
    try {
      this.bigtable = new Bigtable();
      const serviceAccount = require(assertEnvironmentVariable('FIRESTORE_ACCOUNT_KEY_PATH'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      this.firestoreDb = getFirestore();
    } catch (e) {
      throw new Error('Could not load bigtable db');
    }
  }

  async getLastBlockByChain(chain: ChainName): Promise<string | null> {
    if (this.firestoreDb === undefined) {
      this.logger.warn('no firestore db set');
      return null;
    }
    const chainId = coalesceChainId(chain);
    const lastObservedBlock = this.firestoreDb
      .collection(this.latestCollectionName)
      .doc(chainId.toString());
    const lastObservedBlockByChain = await lastObservedBlock.get();
    const blockKeyData = lastObservedBlockByChain.data();
    const lastBlockKey = blockKeyData?.lastBlockKey;
    if (lastBlockKey) {
      this.logger.info(`for chain=${chain}, found most recent firestore block=${lastBlockKey}`);
      return lastBlockKey.split('/')[0];
    }
    return null;
  }

  async storeLatestBlock(chain: ChainName, lastBlockKey: string): Promise<void> {
    if (this.firestoreDb === undefined) {
      this.logger.error('no firestore db set');
      return;
    }
    const chainId = coalesceChainId(chain);
    this.logger.info(`storing last block=${lastBlockKey} for chain=${chainId}`);
    const lastObservedBlock = this.firestoreDb
      .collection(this.latestCollectionName)
      .doc(`${chainId.toString()}`);
    await lastObservedBlock.set({ lastBlockKey });
  }

  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    if (this.bigtable === undefined) {
      this.logger.warn('no bigtable instance set');
      return;
    }
    const chainId = coalesceChainId(chain);
    const filteredBlocks = BigtableDatabase.filterEmptyBlocks(vaasByBlock);
    const instance = this.bigtable.instance(this.instanceId);
    const table = instance.table(this.tableId);
    const rowsToInsert: {
      key: string;
      data: {
        // column family
        info: {
          // columns
          timestamp: { value: string; timestamp: string };
          txHash: { value: string; timestamp: string };
          hasSignedVaa: { value: number; timestamp: string };
        };
      };
    }[] = [];
    Object.keys(filteredBlocks).forEach((blockKey) => {
      const [block, timestamp] = blockKey.split('/');
      filteredBlocks[blockKey].forEach((msgKey) => {
        const [txHash, vaaKey] = msgKey.split(':');
        const [, emitter, seq] = vaaKey.split('/');
        rowsToInsert.push({
          key: `${padUint16(chainId.toString())}/${padUint64(block)}/${emitter}/${padUint64(seq)}`,
          data: {
            // column family
            info: {
              // columns
              timestamp: {
                value: timestamp,
                // write 0 timestamp to only keep 1 cell each
                // https://cloud.google.com/bigtable/docs/gc-latest-value
                timestamp: '0',
              },
              txHash: {
                value: txHash,
                timestamp: '0',
              },
              hasSignedVaa: {
                value: 0,
                timestamp: '0',
              },
            },
          },
        });
      });
    });
    await table.insert(rowsToInsert);

    // store latest vaasByBlock to firestore
    const blockInfos = Object.keys(vaasByBlock);
    if (blockInfos.length) {
      const lastBlockKey = blockInfos[blockInfos.length - 1];
      this.logger.info(`for chain=${chain}, storing last bigtable block=${lastBlockKey}`);
      await this.storeLatestBlock(chain, lastBlockKey);
    }
  }
}
