import { publicrpc } from "@certusone/wormhole-sdk-proto-web";
const { GrpcWebImpl, PublicRPCServiceClientImpl } = publicrpc;

export async function getLastHeartbeats() {
  // Devnet
  // const rpc = new GrpcWebImpl("http://localhost:7071", {});
  // Testnet
  // const rpc = new GrpcWebImpl("https://wormhole-v2-testnet-api.certus.one", {});
  // Mainnet
  const rpc = new GrpcWebImpl("https://wormhole-v2-mainnet-api.certus.one", {});
  const api = new PublicRPCServiceClientImpl(rpc);
  return await api.GetLastHeartbeats({});
}
