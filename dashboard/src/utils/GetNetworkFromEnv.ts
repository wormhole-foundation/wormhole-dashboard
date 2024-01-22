import { NETWORK } from '@wormhole-foundation/wormhole-monitor-common';
import { useNetworkContext } from '../contexts/NetworkContext';

export function GetNetworkFromEnv() {
  const { currentNetwork } = useNetworkContext();
  return currentNetwork.env === 'mainnet' ? NETWORK.MAINNET : NETWORK.TESTNET;
}
