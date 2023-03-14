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
}

export interface HeartbeatNetwork {
  id: number;
  height: string;
  contractAddress: string;
  errorCount: string;
}

export async function getLastHeartbeats(network: Network): Promise<Heartbeat[]> {
  if (network.type === 'guardian') {
    const rpc = new GrpcWebImpl(network.endpoint, {});
    const api = new PublicRPCServiceClientImpl(rpc);
    const lastHeartbeats = await api.GetLastHeartbeats({});
    return lastHeartbeats.entries.reduce<Heartbeat[]>((heartbeats, entry) => {
      if (entry.rawHeartbeat) {
        heartbeats.push(entry.rawHeartbeat);
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
