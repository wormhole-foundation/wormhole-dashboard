import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import ora from 'ora';
import { initDb } from '../src/databases/utils';
import { AXIOS_CONFIG_JSON } from '../src/consts';
import { EVMWatcher, LOG_MESSAGE_PUBLISHED_TOPIC } from '../src/watchers/EVMWatcher';
import { Chain, contracts } from '@wormhole-foundation/sdk-base';

// This script exists because the Arbitrum RPC node only supports a 10 block range which is super slow
// This script only applies to Arbitrum mainnet

(async () => {
  const db = initDb();
  const chain: Chain = 'Arbitrum';
  const endpoint = `https://api.arbiscan.io/api?module=logs&action=getLogs&address=${contracts.coreBridge(
    'Mainnet',
    'Arbitrum'
  )}&topic0=${LOG_MESSAGE_PUBLISHED_TOPIC}&apikey=YourApiKeyToken`;

  // fetch all message publish logs for core bridge contract from explorer
  let log = ora('Fetching logs from Arbiscan...').start();
  const blockNumbers = (await axios.get(endpoint, AXIOS_CONFIG_JSON)).data.result.map((x: any) =>
    parseInt(x.blockNumber, 16)
  );
  log.succeed(`Fetched ${blockNumbers.length} logs from Arbiscan`);
  // use the watcher to fetch corresponding blocks
  log = ora('Fetching blocks...').start();
  const watcher = new EVMWatcher('Mainnet', 'Arbitrum', 'finalized', 'vaa');
  for (const blockNumber of blockNumbers) {
    log.text = `Fetching block ${blockNumber}`;
    const { vaasByBlock } = await watcher.getMessagesForBlocks(blockNumber, blockNumber);
    await db.storeVaasByBlock(chain, vaasByBlock);
  }
  log.succeed('Uploaded messages to db successfully');
})();
