import { Heartbeat, HeartbeatNetwork } from '../utils/getLastHeartbeats';

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
  heartbeats.forEach((heartbeat, hIdx) => {
    heartbeat.networks.forEach((network) => {
      if (!chainIdsToHeartbeats[network.id]) {
        // ensure entry for every guardian
        chainIdsToHeartbeats[network.id] = heartbeats.map((heartbeat) => ({
          guardian: heartbeat.guardianAddr,
          name: heartbeat.nodeName,
          network: {
            ...network,
            contractAddress: '',
            errorCount: '0',
            height: '0',
          },
        }));
      }
      chainIdsToHeartbeats[network.id][hIdx] = {
        guardian: heartbeat.guardianAddr,
        name: heartbeat.nodeName,
        network,
      };
    });
  });
  return chainIdsToHeartbeats;
}
export default useChainHeartbeats;
