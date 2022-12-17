import { loadDb } from "./db";
import { watch } from "./evm";

// TODO: use winston for logging
// TODO: different processes per chain (or don't use ethers, so the whole process doesn't throw on one RPC error)

loadDb();
watch("ethereum", "finalized");
// watch("bsc", "latest"); // requires waiting 15 blocks
// watch("polygon", "latest"); // requires waiting for l1 finality
watch("avalanche", "latest");
watch("oasis", "latest");
// watch("fantom", "latest");
// watch("karura", "latest"); // requires safe mode or finalized
// watch("acala", "latest"); // requires safe mode or finalized
watch("klaytn", "latest");
// watch("celo", "latest"); // requires celo library
// watch("moonbeam", "latest"); // requires isFinal check
// watch("arbitrum", "latest"); // requires waiting for l1 finality
