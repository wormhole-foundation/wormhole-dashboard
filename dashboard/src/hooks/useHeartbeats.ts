import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { getLastHeartbeats, Heartbeat } from '../utils/getLastHeartbeats';
import { GUARDIAN_SET } from '@wormhole-foundation/wormhole-monitor-common';

function useHeartbeats(currentGuardianSet: string | null): Heartbeat[] {
  const { currentNetwork } = useNetworkContext();
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  useEffect(() => {
    setHeartbeats([]);
  }, [currentNetwork, currentGuardianSet]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const heartbeats = await getLastHeartbeats(currentNetwork, currentGuardianSet);
        if (!cancelled) {
          // Add placeholder entries for guardians that haven't heartbeated
          if (currentNetwork.env === 'Mainnet') {
            const seen = new Set(heartbeats.map((hb) => hb.guardianAddr.toLowerCase()));
            for (const guardian of GUARDIAN_SET) {
              if (!seen.has(guardian.pubkey.toLowerCase())) {
                heartbeats.push({
                  guardianAddr: guardian.pubkey,
                  nodeName: guardian.name,
                  networks: [],
                  version: '',
                  counter: '0',
                  timestamp: '',
                  bootTimestamp: '',
                  features: [],
                });
              }
            }
          }
          setHeartbeats(heartbeats.sort((a, b) => a.nodeName.localeCompare(b.nodeName)));
          await new Promise((resolve) =>
            setTimeout(resolve, currentNetwork.type === 'guardian' ? 1000 : 10000)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork, currentGuardianSet]);
  return heartbeats;
}
export default useHeartbeats;
