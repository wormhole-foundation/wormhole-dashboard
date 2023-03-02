import { parse } from '@certusone/wormhole-sdk';
import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_OASIS,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import * as dotenv from 'dotenv';
import { open } from 'fs/promises';
import ora from 'ora';
import { createInterface } from 'readline';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { chunkArray, padUint16, padUint64 } from '@wormhole-foundation/wormhole-monitor-common';
dotenv.config();

// This script provides a summary of the message db

const ACCOUNTANT_CONTRACT_ADDRESS =
  'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465';
let WORMCHAIN_HOST = process.env.WORMCHAIN_HOST;
if (!WORMCHAIN_HOST) {
  throw new Error('WORMCHAIN_HOST is required');
}

// copied from sdk/mainnet_consts.go
const knownTokenbridgeEmitters: { [id: number]: string } = {
  [CHAIN_ID_SOLANA]:
    'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5'.toLowerCase(),
  [CHAIN_ID_ETH]: '0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585'.toLowerCase(),
  [CHAIN_ID_TERRA]:
    '0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2'.toLowerCase(),
  [CHAIN_ID_TERRA2]:
    'a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3'.toLowerCase(),
  [CHAIN_ID_BSC]: '000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7'.toLowerCase(),
  [CHAIN_ID_POLYGON]:
    '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde'.toLowerCase(),
  [CHAIN_ID_AVAX]: '0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052'.toLowerCase(),
  [CHAIN_ID_OASIS]:
    '0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564'.toLowerCase(),
  [CHAIN_ID_ALGORAND]:
    '67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45'.toLowerCase(),
  [CHAIN_ID_APTOS]:
    '0000000000000000000000000000000000000000000000000000000000000001'.toLowerCase(),
  [CHAIN_ID_AURORA]:
    '00000000000000000000000051b5123a7b0F9b2bA265f9c4C8de7D78D52f510F'.toLowerCase(),
  [CHAIN_ID_FANTOM]:
    '0000000000000000000000007C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2'.toLowerCase(),
  [CHAIN_ID_KARURA]:
    '000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624'.toLowerCase(),
  [CHAIN_ID_ACALA]:
    '000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624'.toLowerCase(),
  [CHAIN_ID_KLAYTN]:
    '0000000000000000000000005b08ac39EAED75c0439FC750d9FE7E1F9dD0193F'.toLowerCase(),
  [CHAIN_ID_CELO]: '000000000000000000000000796Dff6D74F3E27060B71255Fe517BFb23C93eed'.toLowerCase(),
  [CHAIN_ID_NEAR]: '148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7'.toLowerCase(),
  [CHAIN_ID_MOONBEAM]:
    '000000000000000000000000B1731c586ca89a23809861c6103F0b96B3F57D92'.toLowerCase(),
  [CHAIN_ID_ARBITRUM]:
    '0000000000000000000000000b2402144Bb366A632D14B83F244D2e0e21bD39c'.toLowerCase(),
  [CHAIN_ID_OPTIMISM]:
    '0000000000000000000000001D68124e65faFC907325e3EDbF8c4d84499DAa8b'.toLowerCase(),
  [CHAIN_ID_XPLA]: '8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c'.toLowerCase(),
  [CHAIN_ID_INJECTIVE]:
    '00000000000000000000000045dbea4617971d93188eda21530bc6503d153313'.toLowerCase(),
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveVAAsToFile(name: string, arr: string[][]): Promise<void> {
  const logMsg = (processed: number, total: number) =>
    `saving VAAs to ${name}: ${((processed / total) * 100).toFixed(2)}% ${processed} / ${total}`;
  const log = ora(logMsg(0, arr.length)).start();
  const f = await open(name, 'w');
  for (let idx = 0; idx < arr.length; idx++) {
    log.text = logMsg(idx + 1, arr.length);
    await f.writeFile(`${arr[idx].join(',')}\n`);
  }
  await f.close();
  log.succeed();
}

async function loadVAAsFromFile(name: string): Promise<string[][]> {
  const arr: string[][] = [];
  const logMsg = (total: number) => `loading VAAs from ${name}: ${total}`;
  const log = ora(logMsg(0)).start();
  const f = await open(name, 'r');
  const stream = f.createReadStream();
  const readline = createInterface({ input: stream });
  for await (const line of readline) {
    arr.push(line.split(','));
    log.text = logMsg(arr.length);
  }
  await f.close();
  log.succeed();
  return arr;
}

(async () => {
  try {
    // STAGE 1
    {
      // const bt = new BigtableDatabase();
      // if (!bt.bigtable) {
      //   throw new Error('bigtable is undefined');
      // }
      // const mainnetInstance = bt.bigtable.instance(bt.instanceId);
      // const messageTable = mainnetInstance.table('signedVAAs');
      //   const observedMessages = (await messageTable.getRows({ decode: false }))[0];
      //   const filteredMessages = [];
      //   const logMsg = (transfers: number, processed: number, total: number) =>
      //     `filtering token bridge transfer VAAs: ${((processed / total) * 100).toFixed(
      //       2
      //     )}% ${transfers} transfers / ${processed} processed / ${total} total`;
      //   const log = ora(logMsg(0, 0, observedMessages.length)).start();
      //   for (let idx = 0; idx < observedMessages.length; idx++) {
      //     const { id, data } = observedMessages[idx];
      //     const bytes = data.info.bytes[0].value;
      //     const [chain, emitter] = id.toString().split('/');
      //     if (knownTokenbridgeEmitters[Number(chain)] === emitter.toLowerCase()) {
      //       try {
      //         const vaa = parse(bytes);
      //         if (vaa.payload.type === 'Transfer' || vaa.payload.type === 'TransferWithPayload') {
      //           filteredMessages.push([id, bytes.toString('hex')]);
      //         }
      //       } catch (e) {
      //         // TODO: dump errors to a log
      //         console.error('error parsing', id);
      //       }
      //     }
      //     log.text = logMsg(filteredMessages.length, idx + 1, observedMessages.length);
      //     await sleep(0); // let the text update
      //   }
      //   log.succeed();
      //   await saveVAAsToFile('filtered.csv', filteredMessages);
    }
    // STAGE 2
    {
      const filteredMessages = await loadVAAsFromFile('filtered.csv');
      const logMsg = (accounted: number, processed: number, total: number) =>
        `filtering token bridge transfer VAAs: ${((processed / total) * 100).toFixed(
          2
        )}% ${accounted} accounted / ${processed} processed / ${total} total`;
      const log = ora(logMsg(0, 0, filteredMessages.length)).start();
      const cosmWasmClient = await CosmWasmClient.connect(WORMCHAIN_HOST);
      const unaccountedMessages = [];
      let processed = 0;
      let accounted = 0;
      let errors = 0;
      // 10000 is too large (400 bad request)
      // 1000 is too large (out of gas: invalid request)
      // 750 works!
      const chunkedMessages = chunkArray(filteredMessages, 750);
      for (const chunk of chunkedMessages) {
        const transfers = chunk.map((message) => {
          const [emitter_chain_str, emitter_address, sequence_str] = message[0].split('/');
          const emitter_chain = Number(emitter_chain_str);
          const sequence = Number(sequence_str);
          return {
            emitter_chain,
            emitter_address,
            sequence,
          };
        });
        try {
          const response = await cosmWasmClient.queryContractSmart(ACCOUNTANT_CONTRACT_ADDRESS, {
            batch_transfer_status: transfers,
          });
          if (response.details.length !== transfers.length) {
            // this shouldn't happen
            throw new Error('transfer missing from response');
          }
          for (const { key, status } of response.details) {
            if (status !== null && 'committed' in status) {
              accounted++;
            } else {
              const correspondingMessage = chunk.find(
                (m) =>
                  m[0] ===
                  `${padUint16(key.emitter_chain.toString())}/${key.emitter_address}/${padUint64(
                    key.sequence.toString()
                  )}`
              );
              if (!correspondingMessage) {
                // this shouldn't happen
                throw new Error('response missing from messages');
              }
              unaccountedMessages.push(correspondingMessage);
            }
          }
        } catch (e) {
          console.error(e);
          errors += transfers.length;
          unaccountedMessages.push(...chunk);
        }
        processed += chunk.length;
        if (accounted + unaccountedMessages.length !== processed) {
          // this shouldn't happen
          throw new Error('bad count!');
        }
        log.text = logMsg(accounted, processed, filteredMessages.length);
        await sleep(0); // let the text update
      }
      log.succeed();
      console.log(
        `Accounted: ${accounted}, Unaccounted: ${unaccountedMessages.length}, Errored: ${errors}, Total: ${filteredMessages.length}`
      );
      await saveVAAsToFile('unaccounted.csv', unaccountedMessages);
    }
  } catch (e) {
    console.error(e);
  }
})();
