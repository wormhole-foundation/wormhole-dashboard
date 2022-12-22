import * as dotenv from 'dotenv';
dotenv.config();
import { initDb } from './databases/utils';
import { watch } from './watch';

initDb();
// watch('ethereum');
watch('bsc');
watch('polygon');
watch('avalanche');
watch('oasis');
watch('fantom');
watch('karura');
watch('acala');
watch('klaytn');
watch('celo');
watch('moonbeam');
// watch('arbitrum'); // TODO: requires waiting for l1 finality
