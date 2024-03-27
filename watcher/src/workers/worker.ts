import { initDb } from '../databases/utils';
import { makeFinalizedWatcher } from '../watchers/utils';
import { workerData } from 'worker_threads';

initDb(false);
const network = workerData.network;
const chain = workerData.chain;
console.log(`Making watcher for ${network} ${chain}...`);
makeFinalizedWatcher(network, chain).watch();
console.log(`Watcher for ${network} ${chain} started.`);
