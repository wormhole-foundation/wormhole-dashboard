import { GetFinalizedBlockNumberResult } from "../watch";
import { createGetBlockByTagForEVM } from "./evm";

export function createGetFinalizedBlockNumberForBSC() {
  const getLatestBlock = createGetBlockByTagForEVM("bsc");
  return async (): GetFinalizedBlockNumberResult => {
    const latestBlock = await getLatestBlock();
    if (latestBlock !== null) {
      return Math.max(latestBlock - 15, 0);
    }
    return null;
  };
}
