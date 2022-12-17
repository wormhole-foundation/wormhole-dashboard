import { loadDb } from "./db";
import { watch } from "./evm";

loadDb();
watch("ethereum", "finalized");
watch("avalanche", "latest");
