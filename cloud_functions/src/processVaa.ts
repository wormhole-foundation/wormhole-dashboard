import { Context, EventFunction } from '@google-cloud/functions-framework/build/src/functions';
import { PubsubMessage } from '@google-cloud/pubsub/build/src/publisher';
import { Bigtable, Instance, Table } from '@google-cloud/bigtable';
import knex, { Knex } from 'knex';
import {
  ParsedAttestMetaVaa,
  ParsedTokenTransferVaa,
  TokenBridgePayload,
  assertChain,
  parseAttestMetaPayload,
  parseTokenTransferPayload,
  parseVaa,
} from '@certusone/wormhole-sdk';
import { isTokenBridgeEmitter } from '@wormhole-foundation/wormhole-monitor-common';
import {
  createAttestMessage,
  createTokenMetadata,
  createTokenTransfer,
} from '@wormhole-foundation/wormhole-monitor-database';
import { assertEnvironmentVariable } from './utils';

let initialized = false;
let bigtable: Bigtable;
let instance: Instance;
let signedVAAsTable: Table;
let tokenTransferTable: string;
let attestMessageTable: string;
let tokenMetadataTable: string;
let pg: Knex;
const signedVAAsRowKeyRegex = /^\d{5}\/\w{64}\/\d{20}$/;

function initialize() {
  bigtable = new Bigtable();
  instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
  signedVAAsTable = instance.table(assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID'));
  tokenTransferTable = assertEnvironmentVariable('PG_TOKEN_TRANSFER_TABLE');
  attestMessageTable = assertEnvironmentVariable('PG_ATTEST_MESSAGE_TABLE');
  tokenMetadataTable = assertEnvironmentVariable('PG_TOKEN_METADATA_TABLE');
  pg = knex({
    client: 'pg',
    connection: {
      user: assertEnvironmentVariable('PG_USER'),
      password: assertEnvironmentVariable('PG_PASSWORD'),
      database: assertEnvironmentVariable('PG_DATABASE'),
      host: assertEnvironmentVariable('PG_HOST'),
    },
  });
  console.log('initialized global variables');
  initialized = true;
}

export const processVaa: EventFunction = async (message: PubsubMessage, context: Context) => {
  if (!initialized) {
    initialize();
  }
  try {
    const rowKey = Buffer.from(message.data as string, 'base64').toString();
    if (!signedVAAsRowKeyRegex.test(rowKey)) {
      console.error(`Invalid row key ${rowKey}`);
      return;
    }
    const [chain, emitter] = rowKey.split('/');
    const chainId = Number(chain);
    assertChain(chainId);
    if (!isTokenBridgeEmitter(chainId, emitter)) {
      return;
    }
    const [row] = await signedVAAsTable.row(rowKey).get({ decode: false });
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
        const tokenTransfer = createTokenTransfer(tokenTransferVaa);
        await pg(tokenTransferTable).insert(tokenTransfer).onConflict().ignore();
      } else if (payloadType === TokenBridgePayload.AttestMeta) {
        const payload = parseAttestMetaPayload(vaa.payload);
        const attestMetaVaa: ParsedAttestMetaVaa = { ...vaa, ...payload };
        const attestMessage = createAttestMessage(attestMetaVaa);
        const tokenMetadata = createTokenMetadata(attestMetaVaa);
        await pg.transaction(async (trx) => {
          await trx(attestMessageTable).insert(attestMessage).onConflict().ignore();
          await trx(tokenMetadataTable).insert(tokenMetadata).onConflict().ignore();
        });
      }
    }
    console.log(`Processed signed VAA: ${rowKey}`);
  } catch (e) {
    console.error(e);
  }
};
