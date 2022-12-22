import {
  ChainId,
  ChainName,
  coalesceChainId,
  CHAINS,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
// need firestore for reading last blocks
import { assertEnvironmentVariable } from '../utils/environment';
import { Database } from './Database';
// set up bigtable
import { VaasByBlock, DB } from './types';
import { Bigtable, Row } from '@google-cloud/bigtable';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export class BigtableDatabase extends Database {
  db: DB;
  tableId: string;
  instanceId: string;
  bigtable: Bigtable | undefined;
  firestoreDb: FirebaseFirestore.Firestore | undefined;
  latestCollectionName: string;
  constructor() {
    super();
    this.db = {};
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
  async loadDb(): Promise<DB> {
    if (this.bigtable === undefined) {
      this.db = {};
    } else {
      const instance = this.bigtable.instance(this.instanceId);
      const table = instance.table(this.tableId);
      try {
        for (const [chainName, chainId] of Object.entries(CHAINS)) {
          let dbByChain: VaasByBlock = {};
          const prefix = `${chainId}/`;
          const observedBlocks = await table.getRows({
            prefix,
          });
          observedBlocks[0].forEach((row: Row) => {
            if (row.hasOwnProperty('id')) {
              let vaa_arr = [];
              for (const ix of Object.keys(row?.data?.vaas)) {
                vaa_arr.push(row?.data?.vaas[ix][0].value); //row?.data?.vaas?.['0'][0]?.value;
              }
              dbByChain[row?.id] = vaa_arr;
            }
          });
          this.db[chainId as ChainId] = dbByChain;
        }
      } catch (e) {
        this.db = {};
      }
    }
    return this.db;
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
    const vaasByBlock = lastObservedBlockByChain.data() || {};
    if (vaasByBlock) {
      this.logger.info(
        `for chain=${chain}, found most recent firestore block=${vaasByBlock?.lastBlock}`
      );
      return vaasByBlock?.lastBlock;
    }
    return null;
  }

  async storeLatestBlock(chain: ChainName, lastBlock: string): Promise<void> {
    if (this.firestoreDb === undefined) {
      this.logger.error('no firestore db set');
      return;
    }
    const chainId = coalesceChainId(chain);
    this.logger.info(`storing last block=${lastBlock} for chain=${chainId}`);
    const lastOservedBlock = this.firestoreDb
      .collection(this.latestCollectionName)
      .doc(`${chainId.toString()}`);
    await lastOservedBlock.set({ lastBlock } || {});
  }

  async storeVaasByBlock(chain: ChainName, vaasByBlock: VaasByBlock): Promise<void> {
    if (this.bigtable === undefined) {
      this.logger.warn('no bigtable instance set');
      return;
    }
    const chainId = coalesceChainId(chain);
    const filteredBlocks = BigtableDatabase.filterEmptyBlocks(vaasByBlock);
    this.db[chainId] = { ...(this.db[chainId] || {}), ...filteredBlocks };
    const instance = this.bigtable.instance(this.instanceId);
    const table = instance.table(this.tableId);
    const rowsToInsert: { key: string; data: { vaas: string[] } }[] = [];
    Object.keys(filteredBlocks).forEach((vaaKey) => {
      rowsToInsert.push({
        key: `${chainId}/${vaaKey}`,
        data: {
          vaas: filteredBlocks[vaaKey],
        },
      });
    });
    await table.insert(rowsToInsert);

    // store latest vaasByBlock to firestore
    let lastBlock = undefined;
    if (vaasByBlock) {
      const blockInfos = Object.keys(vaasByBlock);
      if (blockInfos.length) {
        lastBlock = blockInfos[blockInfos.length - 1].split('/')[0];
        this.logger.info(`for chain=${chain}, storing last bigtable block=${lastBlock}`);
      }
    }
    if (lastBlock !== undefined) {
      await this.storeLatestBlock(chain, lastBlock);
    }
  }
}
