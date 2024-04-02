import { publicrpc } from '@certusone/wormhole-sdk-proto-web';
import { Chain, ChainId, toChainId } from '@wormhole-foundation/sdk-base';
const { GrpcWebImpl, PublicRPCServiceClientImpl } = publicrpc;

export async function getSignedVAA(
  host: string,
  emitterChain: ChainId | Chain,
  emitterAddress: string,
  sequence: string,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new PublicRPCServiceClientImpl(rpc);
  return await api.GetSignedVAA({
    messageId: {
      emitterChain: toChainId(emitterChain) as publicrpc.ChainID,
      emitterAddress,
      sequence,
    },
  });
}

export async function getSignedVAAWithRetry(
  hosts: string[],
  emitterChain: ChainId | Chain,
  emitterAddress: string,
  sequence: string,
  extraGrpcOpts = {},
  retryTimeout = 1000,
  retryAttempts?: number
) {
  let currentWormholeRpcHost = -1;
  const getNextRpcHost = () => ++currentWormholeRpcHost % hosts.length;
  let result;
  let attempts = 0;
  while (!result) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, retryTimeout));
    try {
      result = await getSignedVAA(
        hosts[getNextRpcHost()],
        emitterChain,
        emitterAddress,
        sequence,
        extraGrpcOpts
      );
    } catch (e) {
      if (retryAttempts !== undefined && attempts > retryAttempts) {
        throw e;
      }
    }
  }
  return result;
}

export default getSignedVAAWithRetry;
