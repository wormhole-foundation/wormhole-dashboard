// useRateLimits.ts
import { useState, useEffect } from 'react';
import { RateLimit, getRateLimits } from '../utils/nttHelpers';
import { Network } from '../contexts/NetworkContext';

const REFRESH_INTERVAL = 60_000; // 1 minute

export function useRateLimits(network: Network) {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchRateLimits = async () => {
      if (cancelled) return;
      const limits = await getRateLimits(network);
      setRateLimits(limits);
    };

    const startAutoRefresh = async () => {
      while (!cancelled) {
        await fetchRateLimits();
        await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL));
      }
    };

    startAutoRefresh();

    return () => {
      cancelled = true;
    };
  }, [network]);

  return rateLimits;
}
