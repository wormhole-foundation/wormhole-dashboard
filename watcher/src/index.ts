import { loadDb } from "./db";
import { watch } from "./evm";

// TODO: use winston for logging
// TODO: different processes per chain (or don't use ethers, so the whole process doesn't throw on one RPC error)

loadDb();
// watch("ethereum", "finalized");
// watch("bsc", "latest"); // TODO: requires waiting 15 blocks
// watch("polygon", "latest"); // TODO: requires waiting for l1 finality
watch("avalanche", "latest");
watch("oasis", "latest");
// watch("fantom", "latest");
// watch("karura", "latest"); // TODO: requires safe mode or finalized
// watch("acala", "latest"); // TODO: equires safe mode or finalized
// watch("klaytn", "latest"); // TODO: doesn't support batch provider and need to sleep between block queries
// watch("celo", "latest"); // TODO: requires celo library
// watch("moonbeam", "latest"); // TODO: requires isFinal check
// watch("arbitrum", "latest"); // TODO: requires waiting for l1 finality
