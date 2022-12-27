import { ChainName, coalesceChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { parseVaa } from '@certusone/wormhole-sdk/lib/cjs/vaa/wormhole';
import { Bigtable } from '@google-cloud/bigtable';
import {
  assertEnvironmentVariable,
  chunkArray,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Database } from './Database';
import {
  BigtableMessagesResultRow,
  BigtableMessagesRow,
  BigtableVAAsResultRow,
  VaasByBlock,
} from './types';
import { makeMessageId, makeVaaId, parseMessageId } from './utils';

const WATCH_MISSING_TIMEOUT = 5 * 60 * 1000;

export class BigtableDatabase extends Database {
  tableId: string;
  instanceId: string;
  bigtable: Bigtable;
  firestoreDb: FirebaseFirestore.Firestore;
  latestCollectionName: string;
  constructor() {
    super();
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
    const chainId = coalesceChainId(chain);
    const lastObservedBlock = this.firestoreDb
      .collection(this.latestCollectionName)
      .doc(chainId.toString());
    const lastObservedBlockByChain = await lastObservedBlock.get();
    const blockKeyData = lastObservedBlockByChain.data();
    const lastBlockKey = blockKeyData?.lastBlockKey;
    if (lastBlockKey) {
      this.logger.info(`for chain=${chain}, found most recent firestore block=${lastBlockKey}`);
      const tokens = lastBlockKey.split('/');
      return chain === 'aptos' ? tokens.at(-1) : tokens[0];
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

  async storeVaasByBlock(
    chain: ChainName,
    vaasByBlock: VaasByBlock,
    updateLatestBlock: boolean = true
  ): Promise<void> {
    if (this.bigtable === undefined) {
      this.logger.warn('no bigtable instance set');
      return;
    }
    const chainId = coalesceChainId(chain);
    const filteredBlocks = BigtableDatabase.filterEmptyBlocks(vaasByBlock);
    const instance = this.bigtable.instance(this.instanceId);
    const table = instance.table(this.tableId);
    const rowsToInsert: BigtableMessagesRow[] = [];
    Object.keys(filteredBlocks).forEach((blockKey) => {
      const [block, timestamp] = blockKey.split('/');
      filteredBlocks[blockKey].forEach((msgKey) => {
        const [txHash, vaaKey] = msgKey.split(':');
        const [, emitter, seq] = vaaKey.split('/');
        rowsToInsert.push({
          key: makeMessageId(chainId, block, emitter, seq),
          data: {
            info: {
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

    if (updateLatestBlock) {
      // store latest vaasByBlock to firestore
      const blockInfos = Object.keys(vaasByBlock);
      if (blockInfos.length) {
        const lastBlockKey = blockInfos[blockInfos.length - 1];
        this.logger.info(`for chain=${chain}, storing last bigtable block=${lastBlockKey}`);
        await this.storeLatestBlock(chain, lastBlockKey);
      }
    }
  }

  async updateMessageStatuses(messageKeys: string[]): Promise<void> {
    const instance = this.bigtable.instance(this.instanceId);
    const table = instance.table(this.tableId);
    const chunkedMessageKeys = chunkArray(messageKeys, 1000);
    for (const chunk of chunkedMessageKeys) {
      const rowsToInsert: BigtableMessagesRow[] = chunk.map((id) => ({
        key: id,
        data: {
          info: {
            hasSignedVaa: {
              value: 1,
              timestamp: '0',
            },
          },
        },
      }));
      await table.insert(rowsToInsert);
    }
  }

  async fetchMissingVaaMessages(): Promise<BigtableMessagesResultRow[]> {
    const instance = this.bigtable.instance(this.instanceId);
    const messageTable = instance.table(this.tableId);
    // TODO: how to filter to only messages with hasSignedVaa === 0
    const observedMessages = (await messageTable.getRows())[0] as BigtableMessagesResultRow[];
    const missingVaaMessages = observedMessages.filter(
      (x) => x.data.info.hasSignedVaa?.[0].value === 0
    );
    return missingVaaMessages;
  }

  async watchMissing(): Promise<void> {
    const vaaTableId = assertEnvironmentVariable('BIGTABLE_VAA_TABLE_ID');
    const instance = this.bigtable.instance(this.instanceId);
    const vaaTable = instance.table(vaaTableId);
    while (true) {
      try {
        const missingVaaMessages = await this.fetchMissingVaaMessages();
        const total = missingVaaMessages.length;
        this.logger.info(`locating ${total} messages with hasSignedVAA === 0`);
        let found = 0;
        const chunkedVAAIds = chunkArray(
          missingVaaMessages.map((observedMessage) => {
            const { chain, emitter, sequence } = parseMessageId(observedMessage.id);
            return makeVaaId(chain, emitter, sequence);
          }),
          1000
        );
        let chunkNum = 0;
        const foundRecords: string[] = [];
        for (const chunk of chunkedVAAIds) {
          this.logger.info(`processing chunk ${++chunkNum} of ${chunkedVAAIds.length}`);
          const filter = [
            {
              family: 'QuorumState',
              column: 'SignedVaa',
            },
          ];
          const vaaRows = (
            await vaaTable.getRows({
              keys: chunk,
              decode: false,
              filter,
            })
          )[0] as BigtableVAAsResultRow[];
          for (const row of vaaRows) {
            try {
              const vaaBytes = row.data.QuorumState.SignedVAA?.[0].value;
              if (vaaBytes) {
                const parsed = parseVaa(vaaBytes);
                const matchingIndex = missingVaaMessages.findIndex((observedMessage) => {
                  const { chain, emitter, sequence } = parseMessageId(observedMessage.id);
                  if (
                    parsed.emitterChain === chain &&
                    parsed.emitterAddress.toString('hex') === emitter &&
                    parsed.sequence === sequence
                  ) {
                    return true;
                  }
                });
                if (matchingIndex !== -1) {
                  found++;
                  // remove matches to keep array lean
                  const [matching] = missingVaaMessages.splice(matchingIndex, 1);
                  foundRecords.push(matching.id);
                }
              }
            } catch (e) {}
          }
        }
        this.logger.info(`processed ${total} messages, found ${found}, missing ${total - found}`);
        this.updateMessageStatuses(foundRecords);
      } catch (e) {
        this.logger.error(e);
      }
      await sleep(WATCH_MISSING_TIMEOUT);
    }
  }
}
