import { publicrpc } from '@certusone/wormhole-sdk-proto-web';
import axios from 'axios';
import { Network } from '../contexts/NetworkContext';
const { GrpcWebImpl, PublicRPCServiceClientImpl } = publicrpc;

export interface Heartbeat {
  nodeName: string;
  counter: string;
  timestamp: string;
  networks: HeartbeatNetwork[];
  version: string;
  guardianAddr: string;
  bootTimestamp: string;
  features: string[];
  p2pNodeAddr?: string;
}

export interface HeartbeatNetwork {
  id: number;
  height: string;
  contractAddress: string;
  errorCount: string;
  safeHeight: string;
  finalizedHeight: string;
}

export async function getLastHeartbeats(
  network: Network,
  currentGuardianSet: string | null
): Promise<Heartbeat[]> {
  if (network.type === 'guardian') {
    const rpc = new GrpcWebImpl(network.endpoint, {});
    const api = new PublicRPCServiceClientImpl(rpc);
    const lastHeartbeats = await api.GetLastHeartbeats({});
    return lastHeartbeats.entries.reduce<Heartbeat[]>((heartbeats, entry) => {
      if (
        entry.rawHeartbeat &&
        (!currentGuardianSet ||
          currentGuardianSet
            .toLowerCase()
            .includes(entry.rawHeartbeat.guardianAddr.toLowerCase().substring(2)))
      ) {
        heartbeats.push({ ...entry.rawHeartbeat, p2pNodeAddr: entry.p2pNodeAddr });
      }
      return heartbeats;
    }, []);
  } else if (network.type === 'cloudfunction') {
    const response = await axios.get<{
      heartbeats: Heartbeat[];
    }>(`${network.endpoint}/guardian-heartbeats`);
    return response.data.heartbeats || [];
  }
  throw new Error('Unsupported network');
}
