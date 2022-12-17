import { ChainId, ChainName, coalesceChainId } from "@certusone/wormhole-sdk";

const makeVaaKey = (
  transactionHash: string,
  chain: ChainId | ChainName,
  emitter: string,
  seq: string
) => `${transactionHash}:${coalesceChainId(chain)}/${emitter}/${seq}`;
export default makeVaaKey;
