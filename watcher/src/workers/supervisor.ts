import { Worker } from 'worker_threads';
import { HB_INTERVAL, WorkerData } from '../consts';
import { getLogger } from '../utils/logger';
import { Mode, getMode, getNetwork, sleep } from '@wormhole-foundation/wormhole-monitor-common';
import { Chain, Network } from '@wormhole-foundation/sdk-base';

interface WorkerInfo {
  worker: Worker;
  data: WorkerData;
  lastHB: number;
}

const workers: { [key: string]: WorkerInfo } = {};
const logger = getLogger('supervisor');
const network: Network = getNetwork();
const mode: Mode = getMode();

function spawnWorker(data: WorkerData) {
  const workerName = `${data.chain}Worker`;
  logger.info(`Spawning worker ${workerName} on network ${network} in mode ${mode}...`);
  const worker = new Worker('./dist/src/workers/worker.js', { workerData: data });

  worker.on('message', (message) => {
    if (message === 'heartbeat') {
      logger.debug(`Worker ${workerName} sent HB`);
      workers[workerName].lastHB = Date.now();
    }
  });

  worker.on('exit', (code) => {
    logger.warn(`Worker ${workerName} exited with code ${code}`);
    // Exit code 0 means the worker exited normally and we should not restart it.
    // However, if the supervisor forcibly terminates the worker, the exit code may not be 0
    // and we should not restart it because the supervisor will handle it.
    // In either case, we should not restart the worker here.  Just let the supervisor handle it.
  });

  workers[workerName] = { worker, data, lastHB: Date.now() };
  logger.debug('Finished spawning worker:', workerName);
}

async function monitorWorkers(): Promise<void> {
  while (true) {
    for (const [workerName, workerInfo] of Object.entries(workers)) {
      logger.debug(
        `Checking worker ${workerName} with lastHB of ${new Date(workerInfo.lastHB)}...`
      );
      if (Date.now() - workerInfo.lastHB > HB_INTERVAL) {
        logger.error(`Worker ${workerName} missed HB, restarting...`);
        const exitCode = await workerInfo.worker.terminate();
        logger.error(`Worker ${workerName} forcibly terminated and received exit code ${exitCode}`);
        spawnWorker(workerInfo.data);
      }
    }
    await sleep(HB_INTERVAL);
  }
}

export function startSupervisor(supportedChains: Chain[]) {
  supportedChains.forEach((chain) => {
    const workerData: WorkerData = { network, chain, mode };
    spawnWorker(workerData);
  });

  monitorWorkers();
}
