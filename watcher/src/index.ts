import { loadDb } from "./db";
import { watch } from "./evm";

// TODO: use winston for logging
// TODO: different processes per chain (or don't use ethers, so the whole process doesn't throw on one RPC error)

loadDb();
// watch("ethereum");
// watch("bsc");
// watch("polygon"); // TODO: requires waiting for l1 finality
watch("avalanche");
watch("oasis");
watch("fantom");
// watch("karura"); // TODO: requires safe mode or finalized
// watch("acala"); // TODO: equires safe mode or finalized
// watch("klaytn"); // TODO: doesn't support batch provider and need to sleep between block queries
watch("celo"); // does CeloProvider batch?
// watch("moonbeam"); // TODO: requires isFinal check
// watch("arbitrum"); // TODO: requires waiting for l1 finality
