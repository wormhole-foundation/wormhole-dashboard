import { useState, useEffect } from 'react';
import { Network } from '../contexts/NetworkContext';
import { NTTTotalSupplyAndLockedData } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

export function useTotalSupplyAndLocked(network: Network) {
  const [totalSupplyAndLocked, setTotalSupplyAndLocked] = useState<NTTTotalSupplyAndLockedData[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await axios.post<NTTTotalSupplyAndLockedData[]>(
        `${network.endpoint}/get-total-supply-and-locked`
      );
      if (!cancelled && response.data) {
        setTotalSupplyAndLocked(response.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  return totalSupplyAndLocked;
}
