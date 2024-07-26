import { Context, EventFunction } from '@google-cloud/functions-framework';
import { PubsubMessage } from '@google-cloud/pubsub/build/src/publisher';
import { Bigtable, Instance, Table } from '@google-cloud/bigtable';
import knex, { Knex } from 'knex';
import {
  assertEnvironmentVariable,
  CIRCLE_DOMAIN_TO_CHAIN_ID,
  isCircleIntegrationEmitter,
  isTokenBridgeEmitter,
  universalAddress_stripped,
} from '@wormhole-foundation/wormhole-monitor-common';
import {
  TokenTransfer,
  createAttestMessage,
  createTokenMetadata,
  createTokenTransfer,
} from '@wormhole-foundation/wormhole-monitor-database';
import {
  CircleIntegrationPayload,
  parseCircleIntegrationDepositWithPayload,
} from './_sdk_circleIntegration';
import { toChainId } from '@wormhole-foundation/sdk-base';
import { deserialize } from '@wormhole-foundation/sdk-definitions';

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
    const chainId = toChainId(Number(chain));
    const module = isTokenBridgeEmitter(chainId, emitter)
      ? 'TokenBridge'
      : isCircleIntegrationEmitter(chainId, emitter)
      ? 'CircleIntegration'
      : null;
    if (!module) {
      return;
    }
    const [row] = await signedVAAsTable.row(rowKey).get({ decode: false });
    const vaaBytes = row.data.info.bytes[0].value;
    const vaa = deserialize('Uint8Array', vaaBytes);
    if (vaa.payload.length > 0) {
      const payloadType = vaa.payload[0];
      if (module === 'TokenBridge') {
        if (payloadType === 1 || payloadType === 3) {
          const tokenTransferVaa =
            payloadType === 1
              ? deserialize('TokenBridge:Transfer', vaaBytes)
              : deserialize('TokenBridge:TransferWithPayload', vaaBytes);

          const tokenTransfer: TokenTransfer = createTokenTransfer(tokenTransferVaa);
          await pg(tokenTransferTable).insert(tokenTransfer).onConflict().ignore();
        } else if (payloadType === 2) {
          const attestMetaVaa = deserialize('TokenBridge:AttestMeta', vaaBytes);
          const attestMessage = createAttestMessage(attestMetaVaa);
          const tokenMetadata = createTokenMetadata(attestMetaVaa);
          await pg.transaction(async (trx) => {
            await trx(attestMessageTable).insert(attestMessage).onConflict().ignore();
            await trx(tokenMetadataTable).insert(tokenMetadata).onConflict().ignore();
          });
        }
      } else if (module === 'CircleIntegration') {
        if (payloadType === CircleIntegrationPayload.DepositWithPayload) {
          const payloadBuffer = Buffer.from(vaa.payload);
          const payload = parseCircleIntegrationDepositWithPayload(payloadBuffer);
          const to_chain = CIRCLE_DOMAIN_TO_CHAIN_ID[payload.targetDomain];
          if (!to_chain) {
            throw new Error(`Missing mapping for Circle domain ${payload.targetDomain}`);
          }
          const tokenTransfer: TokenTransfer = {
            timestamp: vaa.timestamp.toString(),
            emitter_chain: toChainId(vaa.emitterChain),
            emitter_address: universalAddress_stripped(vaa.emitterAddress),
            sequence: vaa.sequence.toString(),
            amount: payload.amount.toString(),
            token_address: payload.tokenAddress.toString('hex'),
            token_chain: toChainId(vaa.emitterChain),
            to_address: payload.mintRecipient.toString('hex'),
            to_chain,
            payload_type: Number(payload.payloadType),
            fee: null,
            from_address: payload.fromAddress.toString('hex'),
            module,
          };
          await pg(tokenTransferTable).insert(tokenTransfer).onConflict().ignore();
        }
      }
    }
    console.log(`Processed signed VAA: ${rowKey}`);
  } catch (e) {
    console.error(e);
  }
};
