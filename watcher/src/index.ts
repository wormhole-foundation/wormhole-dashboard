import { loadDb } from './db';
import { watch } from './watch';

// TODO: use winston for logging
// TODO: different processes per chain (or don't use ethers, so the whole process doesn't throw on one RPC error)

loadDb();
// watch('ethereum');
watch('bsc');
watch('polygon');
watch('avalanche');
watch('oasis');
watch('fantom');
watch('karura');
watch('acala');
// watch('klaytn'); // TODO: doesn't support batch provider and need to sleep between block queries
// watch('celo');
watch('moonbeam');
// watch('arbitrum'); // TODO: requires waiting for l1 finality
