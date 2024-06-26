import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { getLastHeartbeats, Heartbeat } from '../utils/getLastHeartbeats';

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
