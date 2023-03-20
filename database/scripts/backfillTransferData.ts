import * as dotenv from 'dotenv';
dotenv.config();
import {
  assertEnvironmentVariable,
  padUint16,
  TOKEN_BRIDGE_EMITTERS,
} from '@wormhole-foundation/wormhole-monitor-common';
import ora from 'ora';
import {
  ChainName,
  ParsedAttestMetaVaa,
  ParsedTokenTransferVaa,
  TokenBridgePayload,
  coalesceChainId,
  parseAttestMetaPayload,
  parseTokenTransferPayload,
  parseVaa,
} from '@certusone/wormhole-sdk';
import { Bigtable } from '@google-cloud/bigtable';
import knex from 'knex';
import {
  batchInsertOrIgnore,
  assertHasTable,
  AttestMessage,
  TokenMetadata,
  TokenTransfer,
  createAttestMessage,
  createTokenMetadata,
  createTokenTransfer,
} from '../src';

const PG_USER = assertEnvironmentVariable('PG_USER');
const PG_PASSWORD = assertEnvironmentVariable('PG_PASSWORD');
const PG_DATABASE = assertEnvironmentVariable('PG_DATABASE');
const PG_HOST = assertEnvironmentVariable('PG_HOST');
const TOKEN_TRANSFER_TABLE = assertEnvironmentVariable('PG_TOKEN_TRANSFER_TABLE');
const ATTEST_MESSAGE_TABLE = assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE');
const TOKEN_METADATA_TABLE = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
const BIGTABLE_SIGNED_VAAS_TABLE_ID = assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID');
const BIGTABLE_INSTANCE_ID = assertEnvironmentVariable('BIGTABLE_INSTANCE_ID');
const BIGTABLE_CHUNK_SIZE = 10_000;

const getStatusString = (
  chain: string,
  numRowsRead: number,
  numTransfersWritten: number,
  numAttestsWritten: number,
  numTokenMetadataWritten: number
) =>
  `${chain}: read ${numRowsRead} signed VAAs, inserted ${numTransfersWritten} transfer, ${numAttestsWritten} attest, and ${numTokenMetadataWritten} metadata rows`;

// This script reads known token bridge emitter signed VAAs from bigtable
// and writes token transfer, attest, and metadata details to postgres
// Note: Run the Cloud SQL Auth proxy before running this script
// https://cloud.google.com/sql/docs/postgres/connect-instance-auth-proxy

(async () => {
  const pg = knex({
    client: 'pg',
    connection: {
      host: PG_HOST,
      // port: 5432, // default
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
    },
  });
  let log = ora('');
  try {
    assertHasTable(pg, TOKEN_TRANSFER_TABLE);
    assertHasTable(pg, ATTEST_MESSAGE_TABLE);
    assertHasTable(pg, TOKEN_METADATA_TABLE);
    const bt = new Bigtable();
    const instance = bt.instance(BIGTABLE_INSTANCE_ID);
    const signedVAAsTable = instance.table(BIGTABLE_SIGNED_VAAS_TABLE_ID);
    const tokenBridgeEmitters = Object.entries(TOKEN_BRIDGE_EMITTERS);
    for (const [chain, emitter] of tokenBridgeEmitters) {
      log.start();
      const paddedChainId = padUint16(coalesceChainId(chain as ChainName).toString());
      let start = `${paddedChainId}/${emitter}/`;
      const end = `${start}z`;
      let numRowsRead = 0;
      let numTransfersWritten = 0;
      let numAttestsWritten = 0;
      let numTokenMetadataWritten = 0;
      let skipFirstRow = false;
      while (true) {
        const signedVAARows = (
          await signedVAAsTable.getRows({
            start,
            end,
            decode: false,
            limit: BIGTABLE_CHUNK_SIZE,
          })
        )[0];
        numRowsRead += signedVAARows.length;
        const tokenTransfers: TokenTransfer[] = [];
        const attestMessages: AttestMessage[] = [];
        const tokenMetadata: TokenMetadata[] = [];
        signedVAARows.forEach((row, index) => {
          if (skipFirstRow && index == 0) {
            return;
          }
          try {
            const vaaBytes = row.data.info.bytes[0].value;
            const vaa = parseVaa(vaaBytes);
            if (vaa.payload.length > 0) {
              const payloadType = vaa.payload[0];
              if (
                payloadType === TokenBridgePayload.Transfer ||
                payloadType === TokenBridgePayload.TransferWithPayload
              ) {
                const payload = parseTokenTransferPayload(vaa.payload);
                const tokenTransferVaa: ParsedTokenTransferVaa = { ...vaa, ...payload };
                tokenTransfers.push(createTokenTransfer(tokenTransferVaa));
              } else if (payloadType === TokenBridgePayload.AttestMeta) {
                const payload = parseAttestMetaPayload(vaa.payload);
                const attestMetaVaa: ParsedAttestMetaVaa = { ...vaa, ...payload };
                attestMessages.push(createAttestMessage(attestMetaVaa));
                tokenMetadata.push(createTokenMetadata(attestMetaVaa));
              }
            }
          } catch {}
        });
        numTransfersWritten += await batchInsertOrIgnore(pg, TOKEN_TRANSFER_TABLE, tokenTransfers);
        numAttestsWritten += await batchInsertOrIgnore(pg, ATTEST_MESSAGE_TABLE, attestMessages);
        numTokenMetadataWritten += await batchInsertOrIgnore(
          pg,
          TOKEN_METADATA_TABLE,
          tokenMetadata
        );
        log.text = getStatusString(
          chain,
          numRowsRead,
          numTransfersWritten,
          numAttestsWritten,
          numTokenMetadataWritten
        );
        if (signedVAARows.length < BIGTABLE_CHUNK_SIZE) {
          break;
        }
        start = signedVAARows[signedVAARows.length - 1].id;
        // the last row of the current batch will be the start/first row of the next batch, so skip it
        skipFirstRow = true;
      }
      log.stopAndPersist();
    }
    log.succeed('Finished');
  } catch (e) {
    console.error(e);
    log.fail('Exception occurred');
  }
  await pg.destroy();
})();
