// useRateLimits.ts
import { useState, useEffect } from 'react';
import { RateLimit, getRateLimits } from '../utils/nttHelpers';
import { Network } from '../contexts/NetworkContext';

const REFRESH_INTERVAL = 120_000; // 2 minutes

export function useRateLimits(network: Network) {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchRateLimits = async () => {
      if (cancelled) return;
      const limits = await getRateLimits(network);
      limits.sort((a, b) => a.tokenName.localeCompare(b.tokenName));
      if (cancelled) return;
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
