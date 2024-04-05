import * as dotenv from 'dotenv';
dotenv.config();

import { Connection } from '@solana/web3.js';
import axios from 'axios';
import ora from 'ora';
import { RPCS_BY_CHAIN } from '../src/consts';
import {
  isLegacyMessage,
  normalizeCompileInstruction,
} from '@wormhole-foundation/wormhole-monitor-common/src/solana';
import { MISS_THRESHOLD_IN_MINS } from '@wormhole-foundation/wormhole-monitor-common';
import { contracts } from '@wormhole-foundation/sdk-base';

// This script finds the message accounts which correspond to solana misses

(async () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - MISS_THRESHOLD_IN_MINS);
  const missThreshold = now.toISOString();
  let log = ora('Fetching Solana misses').start();
  try {
    const response = await axios.get(
      'https://europe-west3-wormhole-message-db-mainnet.cloudfunctions.net/missing-vaas'
    );
    const solanaTxHashes = response.data[1].messages
      .filter((m: any) => m.timestamp < missThreshold)
      .map((m: any) => m.txHash);
    log.succeed();
    log = ora('Fetching message accounts').start();
    const connection = new Connection(RPCS_BY_CHAIN.Mainnet.Solana!, 'finalized');
    const txs = await connection.getTransactions(solanaTxHashes, {
      maxSupportedTransactionVersion: 0,
    });
    // TODO: share with Solana watcher?
    const accounts = [];
    let errorCount = 0;
    for (const tx of txs) {
      if (!tx) {
        errorCount++;
      } else {
        const message = tx.transaction.message;
        const accountKeys = isLegacyMessage(message)
          ? message.accountKeys
          : message.staticAccountKeys;
        const programIdIndex = accountKeys.findIndex(
          (i) => i.toBase58() === contracts.coreBridge('Mainnet', 'Solana')
        );
        const instructions = message.compiledInstructions;
        const innerInstructions =
          tx.meta?.innerInstructions?.flatMap((i) =>
            i.instructions.map(normalizeCompileInstruction)
          ) || [];
        const whInstructions = innerInstructions
          .concat(instructions)
          .filter((i) => i.programIdIndex === programIdIndex);
        for (const instruction of whInstructions) {
          // skip if not postMessage instruction
          const instructionId = instruction.data;
          if (instructionId[0] !== 0x01) continue;

          accounts.push(accountKeys[instruction.accountKeyIndexes[1]]);
        }
      }
    }
    log.succeed();
    for (const a of accounts) {
      console.log(`send-observation-request 1 ${a}`);
    }
    console.log(
      `Fetch ${accounts.length} accounts from ${solanaTxHashes.length} transactions with ${errorCount} errors`
    );
  } catch (e) {
    log.fail();
    console.error(e);
  }
})();
