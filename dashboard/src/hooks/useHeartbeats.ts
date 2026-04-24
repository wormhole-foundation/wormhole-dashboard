import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { getLastHeartbeats, Heartbeat } from '../utils/getLastHeartbeats';
import { GUARDIAN_SET } from '@wormhole-foundation/wormhole-monitor-common';

export type HeartbeatsResult = {
  heartbeats: Heartbeat[];
  receivedAt: string | null;
};

function useHeartbeats(currentGuardianSet: string | null): HeartbeatsResult {
  const { currentNetwork } = useNetworkContext();
  const [result, setResult] = useState<HeartbeatsResult>({ heartbeats: [], receivedAt: null });
  useEffect(() => {
    setResult({ heartbeats: [], receivedAt: null });
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
          setResult({
            heartbeats: heartbeats.sort((a, b) => a.nodeName.localeCompare(b.nodeName)),
            receivedAt: new Date().toISOString(),
          });
          await new Promise((resolve) =>
            setTimeout(resolve, currentNetwork.type === 'guardian' ? 15000 : 30000)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork, currentGuardianSet]);
  return result;
}
export default useHeartbeats;
