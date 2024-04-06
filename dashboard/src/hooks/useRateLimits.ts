// useRateLimits.ts
import { useState, useEffect } from 'react';
import { RateLimit, getRateLimits } from '../utils/nttHelpers';
import { Network } from '../contexts/NetworkContext';

export function useRateLimits(network: Network) {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  useEffect(() => {
    const fetchRateLimits = async () => {
      const limits = await getRateLimits(network);
      setRateLimits(limits);
    };

    fetchRateLimits();
  }, []);

  return rateLimits;
}
