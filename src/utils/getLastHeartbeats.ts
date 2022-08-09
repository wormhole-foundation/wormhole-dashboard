import { publicrpc } from "@certusone/wormhole-sdk-proto-web";
const { GrpcWebImpl, PublicRPCServiceClientImpl } = publicrpc;

export async function getLastHeartbeats() {
  const rpc = new GrpcWebImpl("https://wormhole-v2-mainnet-api.certus.one", {});
  const api = new PublicRPCServiceClientImpl(rpc);
  return await api.GetLastHeartbeats({});
}
