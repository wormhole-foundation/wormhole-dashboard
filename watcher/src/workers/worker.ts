import { initDb } from '../databases/utils';
import { makeFinalizedNTTWatcher, makeFinalizedVaaWatcher } from '../watchers/utils';
import { workerData } from 'worker_threads';

initDb(false);
const network = workerData.network;
const chain = workerData.chain;
const mode = workerData.mode;
console.log(`Making watcher for ${network}, ${chain}, ${mode}...`);
if (mode === 'vaa') {
  makeFinalizedVaaWatcher(network, chain).watch();
} else if (mode === 'ntt') {
  makeFinalizedNTTWatcher(network, chain).watch();
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
console.log(`Watcher for ${network}, ${chain}, ${mode} started.`);
