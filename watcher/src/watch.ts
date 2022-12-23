import { ChainName } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import {
  INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN,
  sleep,
} from '@wormhole-foundation/wormhole-monitor-common';
import { getMaximumBatchSize, TIMEOUT } from './consts';
import { getLastBlockByChain, storeVaasByBlock } from './databases/utils';
import { BSCWatcher } from './watchers/BSCWatcher';
import { EVMWatcher } from './watchers/EVMWatcher';
import { MoonbeamWatcher } from './watchers/MoonbeamWatcher';
import { PolygonWatcher } from './watchers/PolygonWatcher';
import { Watcher } from './watchers/Watcher';

const createWatcherByChain: {
  [chain in ChainName]: () => Watcher;
} = {
  unset: () => new Watcher('unset'),
  solana: () => new Watcher('solana'),
  ethereum: () => new EVMWatcher('ethereum', 'finalized'),
  terra: () => new Watcher('terra'),
  bsc: () => new BSCWatcher(),
  polygon: () => new PolygonWatcher(),
  avalanche: () => new EVMWatcher('avalanche'),
  oasis: () => new EVMWatcher('oasis'),
  algorand: () => new Watcher('algorand'),
  aurora: () => new Watcher('aurora'),
  fantom: () => new EVMWatcher('fantom'),
  karura: () => new EVMWatcher('karura', 'finalized'),
  acala: () => new EVMWatcher('acala', 'finalized'),
  klaytn: () => new EVMWatcher('klaytn'),
  celo: () => new EVMWatcher('celo'),
  near: () => new Watcher('near'),
  moonbeam: () => new MoonbeamWatcher(),
  neon: () => new Watcher('neon'),
  terra2: () => new Watcher('terra2'),
  injective: () => new Watcher('injective'),
  osmosis: () => new Watcher('osmosis'),
  sui: () => new Watcher('sui'),
  aptos: () => new Watcher('aptos'),
  arbitrum: () => new Watcher('arbitrum'),
  optimism: () => new Watcher('optimism'),
  gnosis: () => new Watcher('gnosis'),
  pythnet: () => new Watcher('pythnet'),
  xpla: () => new Watcher('xpla'),
  btc: () => new Watcher('btc'),
  wormchain: () => new Watcher('wormchain'),
};

export async function watch(chain: ChainName) {
  const watcher = createWatcherByChain[chain]();
  let toBlock: number | null = null;
  const lastReadBlock: string | null =
    (await getLastBlockByChain(chain)) || INITIAL_DEPLOYMENT_BLOCK_BY_CHAIN[chain] || null;
  let fromBlock: number | null = lastReadBlock !== null ? Number(lastReadBlock) : toBlock;
  let retry = 0;
  while (true) {
    try {
      if (fromBlock && toBlock && fromBlock <= toBlock) {
        // fetch logs for the block range
        toBlock = Math.min(fromBlock + getMaximumBatchSize(chain) - 1, toBlock); // fix for "block range is too wide" or "maximum batch size is 50, but received 101"
        watcher.logger.info(`fetching messages from ${fromBlock} to ${toBlock}`);
        const vaasByBlock = await watcher.getMessagesForBlocks(fromBlock, toBlock);
        await storeVaasByBlock(chain, vaasByBlock);
        fromBlock = toBlock + 1;
        await sleep(TIMEOUT);
      }
      try {
        watcher.logger.info('fetching finalized block');
        toBlock = await watcher.getFinalizedBlockNumber();
        retry = 0;
      } catch (e) {
        toBlock = null;
        watcher.logger.error(`error fetching finalized block`);
        throw e;
      }
    } catch (e) {
      retry++;
      watcher.logger.error(e);
      const expoBacko = TIMEOUT * 2 ** retry;
      watcher.logger.warn(`backing off for ${expoBacko}ms`);
      await sleep(expoBacko);
    }
  }
}
