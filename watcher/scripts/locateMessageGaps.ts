import { sleep } from '@wormhole-foundation/wormhole-monitor-common';
import * as dotenv from 'dotenv';
import { TIMEOUT } from '../src/consts';
dotenv.config();
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { VaasByBlock } from '../src/databases/types';
import { parseMessageId } from '../src/databases/utils';
import { EVMWatcher } from '../src/watchers';

// This script checks for gaps in the message sequences for an emitter.
// Ideally this shouldn't happen, but there seems to be an issue with Oasis, Karura, and Celo

(async () => {
  const bt = new BigtableDatabase();
  if (!bt.bigtable) {
    throw new Error('bigtable is undefined');
  }
  const instance = bt.bigtable.instance(bt.instanceId);
  const messageTable = instance.table(bt.tableId);
  try {
    // STEP 1
    const observedMessages = (await messageTable.getRows())[0].sort((a, b) =>
      Number(parseMessageId(a.id).sequence - parseMessageId(b.id).sequence)
    );
    const total = observedMessages.length;
    console.log(`processing ${total} messages`);
    const gaps = [];
    const sequenceAndBlockByEmitter: { [emitter: string]: { sequence: bigint; block: number } } =
      {};
    for (const observedMessage of observedMessages) {
      const {
        chain: emitterChain,
        block,
        emitter: emitterAddress,
        sequence,
      } = parseMessageId(observedMessage.id);
      const emitter = `${emitterChain}/${emitterAddress}`;
      if (!sequenceAndBlockByEmitter[emitter]) {
        sequenceAndBlockByEmitter[emitter] = { sequence: 0n, block: 0 };
      }
      while (sequence > sequenceAndBlockByEmitter[emitter].sequence + 1n) {
        sequenceAndBlockByEmitter[emitter] = {
          ...sequenceAndBlockByEmitter[emitter],
          sequence: sequenceAndBlockByEmitter[emitter].sequence + 1n,
        };
        gaps.push(
          `${emitterChain}/${
            sequenceAndBlockByEmitter[emitter].block
          }-${block}/${emitterAddress}/${sequenceAndBlockByEmitter[emitter].sequence.toString()}`
        );
      }
      sequenceAndBlockByEmitter[emitter] = { sequence, block };
    }
    console.log(sequenceAndBlockByEmitter);
    console.log(gaps);
    // RESULT
    // [
    //   '7/3915481-3920902/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16935',
    //   '7/3950419-3958386/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16945',
    //   '7/3966267-3969101/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16948',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/565',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/566',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/567',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/568',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/569',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/570',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/571',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/572',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/573',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/574',
    //   '11/3270096-3348041/000000000000000000000000ae9d7fe007b3327aa64a32824aaac52c42a6e624/575',
    //   '14/16839837-16842715/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2277',
    //   '14/16857644-16858236/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2290',
    //   '14/16862276-16869927/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2296',
    //   '14/16862276-16869927/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2297',
    //   '14/16914366-16916600/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2321',
    // ];
    // STEP 2
    // Oasis
    // const oasis = new EVMWatcher('oasis');
    // let fromBlock = 3966267;
    // const endBlock = 3969101;
    // while (fromBlock < endBlock) {
    //   const toBlock = Math.min(fromBlock + oasis.maximumBatchSize - 1, endBlock);
    //   const messages = await oasis.getMessagesForBlocks(fromBlock, toBlock);
    //   console.log(Object.entries(messages).filter(([key, value]) => value.length > 0));
    //   fromBlock = toBlock + 1;
    //   await sleep(TIMEOUT);
    // }
    // Karura
    // const karura = new EVMWatcher('karura', 'finalized');
    // let fromBlock = 3270096; // resume
    // const endBlock = 3348041;
    // const foundMessages = [];
    // while (fromBlock < endBlock) {
    //   try {
    //     const toBlock = Math.min(fromBlock + karura.maximumBatchSize - 1, endBlock);
    //     const messages = await karura.getMessagesForBlocks(fromBlock, toBlock);
    //     console.log('karura', fromBlock, toBlock);
    //     const nonEmptyBlocks = Object.entries(messages).filter(([key, value]) => value.length > 0);
    //     if (nonEmptyBlocks.length > 0) {
    //       console.log(nonEmptyBlocks);
    //       foundMessages.push(...nonEmptyBlocks);
    //     }
    //     fromBlock = toBlock + 1;
    //   } catch (e) {
    //     console.log('an error occurred, retrying');
    //   }
    //   await sleep(TIMEOUT);
    // }
    // console.log(foundMessages);
    // Celo
    // const celo = new EVMWatcher('celo');
    // let fromBlock = 16914366;
    // const endBlock = 16916600;
    // while (fromBlock < endBlock) {
    //   const toBlock = Math.min(fromBlock + celo.maximumBatchSize - 1, endBlock);
    //   const messages = await celo.getMessagesForBlocks(fromBlock, toBlock);
    //   console.log(Object.entries(messages).filter(([key, value]) => value.length > 0));
    //   fromBlock = toBlock + 1;
    //   await sleep(TIMEOUT);
    // }
    // STEP 3
    // const oasisFixes: VaasByBlock = {
    //   '3918344/2022-12-24T13:01:11.000Z': [
    //     '0x3b0a1ca9633b1dd3469b035373c8f14b04fc1af5feaed860832a5fe01d751bda:7/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16935',
    //   ],
    //   '3958280/2022-12-28T08:08:51.000Z': [
    //     '0x1b5702943a87b66225352d8281011461b4f3f6427d4d27545a3a6d77e2652dae:7/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16945',
    //   ],
    //   '3966701/2022-12-29T02:35:39.000Z': [
    //     '0xfe4d6002ef00b7880a8936d1ae7010a2820e77eca8f5172bf0e32a194c9a831c:7/0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564/16948',
    //   ],
    // };
    // bt.storeVaasByBlock('oasis', oasisFixes, false);
    // const karuraFixes: VaasByBlock = {};
    // bt.storeVaasByBlock('karura', karuraFixes, false);
    // const celoFixes: VaasByBlock = {
    //   '16841434/2022-12-24T09:46:54.000Z': [
    //     '0x0f5b3960c40cc9b6d4df6dedf633c3d0805bcb3b5feb5ac5040abfa65959b20f:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2277',
    //   ],
    //   '16858188/2022-12-25T09:03:04.000Z': [
    //     '0x9f7682802129d9878d7ad40d44974dc07752c91ec153d6c722e1d2f0bf795cf9:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2290',
    //   ],
    //   '16863892/2022-12-25T16:58:24.000Z': [
    //     '0x19904cc7ceff148bcbcbd24bb0062bb89478c72a029d165ee939cd21bd17e6db:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2296',
    //   ],
    //   '16869377/2022-12-26T00:35:29.000Z': [
    //     '0x5ab3c92d8c071e803ab2eb0f27923c70e47cad3a26341f60a3d604ba7da980ef:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2297',
    //   ],
    //   '16915796/2022-12-28T17:03:48.000Z': [
    //     '0xf314c58ea7e90af73da45fd7505f1bfa4f269406ece80a7ebdcf075021db03de:14/000000000000000000000000796dff6d74f3e27060b71255fe517bfb23c93eed/2321',
    //   ],
    // };
    // bt.storeVaasByBlock('celo', celoFixes, false);
  } catch (e) {
    console.error(e);
  }
})();
