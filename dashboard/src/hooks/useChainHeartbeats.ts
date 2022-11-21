import { Heartbeat, HeartbeatNetwork } from "../utils/getLastHeartbeats";

export type HeartbeatInfo = {
  guardian: string;
  name: string;
  network: HeartbeatNetwork;
};

export type ChainIdToHeartbeats = {
  [chainId: number]: HeartbeatInfo[];
};

function useChainHeartbeats(heartbeats: Heartbeat[]) {
  const chainIdsToHeartbeats: ChainIdToHeartbeats = {};
  heartbeats.forEach((heartbeat) => {
    heartbeat.networks.forEach((network) => {
      if (!chainIdsToHeartbeats[network.id]) {
        chainIdsToHeartbeats[network.id] = [];
      }
      chainIdsToHeartbeats[network.id].push({
        guardian: heartbeat.guardianAddr,
        name: heartbeat.nodeName,
        network,
      });
    });
  });
  return chainIdsToHeartbeats;
}
export default useChainHeartbeats;
