import { publicrpc } from "@certusone/wormhole-sdk-proto-web";
import { Network } from "../contexts/NetworkContext";
const { GrpcWebImpl, PublicRPCServiceClientImpl } = publicrpc;

export async function getGovernorAvailableNotionalByChain(network: Network) {
  const rpc = new GrpcWebImpl(
    network === "devnet"
      ? "http://localhost:7071"
      : network === "testnet"
      ? "https://wormhole-v2-testnet-api.certus.one"
      : "https://wormhole-v2-mainnet-api.certus.one",
    {}
  );
  const api = new PublicRPCServiceClientImpl(rpc);
  return await api.GovernorGetAvailableNotionalByChain({});
}
