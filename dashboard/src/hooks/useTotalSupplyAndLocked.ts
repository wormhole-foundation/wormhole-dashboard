import { useState, useEffect } from 'react';
import { Network } from '../contexts/NetworkContext';
import { NTTTotalSupplyAndLockedData } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

const REFRESH_INTERVAL = 120_000; // 2 minutes

export function useTotalSupplyAndLocked(network: Network) {
  const [totalSupplyAndLocked, setTotalSupplyAndLocked] = useState<NTTTotalSupplyAndLockedData[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;

    const fetchTotalSupplyAndLocked = async () => {
      if (cancelled) return;
      const response = await axios.post<NTTTotalSupplyAndLockedData[]>(
        `${network.endpoint}/get-total-supply-and-locked`
      );
      if (!cancelled && response.data) {
        setTotalSupplyAndLocked(response.data);
      }
    };

    const startAutoRefresh = async () => {
      while (!cancelled) {
        await fetchTotalSupplyAndLocked();
        await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL));
      }
    };

    startAutoRefresh();

    return () => {
      cancelled = true;
    };
  }, [network]);

  return totalSupplyAndLocked;
}
