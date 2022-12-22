import { ChainId, ChainName, coalesceChainId, CHAINS } from '@certusone/wormhole-sdk';
// need firestore for reading last blocks
import { assertEnvironmentVariable } from '../utils/environment';
import { Database } from './Database';
// set up bigtable
import { VaasByBlock, DB } from './types';
import { Bigtable, Row } from '@google-cloud/bigtable';
import { FirestoreDatabase } from './FirestoreDatabase';

export class BigtableDatabase extends Database {
  db: DB;
  tableId: string;
  instanceId: string;
  bigtable: Bigtable | undefined;
  firestore: FirestoreDatabase;
  constructor() {
    super();
    this.db = {};
    this.bigtable = undefined;
    this.firestore = new FirestoreDatabase();
    this.tableId = assertEnvironmentVariable('BIGTABLE_TABLE_ID');
    this.instanceId = assertEnvironmentVariable('BIGTABLE_INSTANCE_ID');
    try {
      this.bigtable = new Bigtable();
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
    // update firestore with latest Block seen
    // should grab last blocks from firestore
    // let firestore = new FirestoreDatabase();
    return await this.firestore.getLastBlockByChain(chain);
  }

  async storeLatestBlock(chain: ChainName, lastBlock: string): Promise<void> {
    await this.firestore.storeLatestBlock(chain, lastBlock);
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
