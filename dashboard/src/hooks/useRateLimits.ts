import { useState, useEffect } from 'react';
import { Network } from '../contexts/NetworkContext';
import { NTTRateLimit } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

const REFRESH_INTERVAL = 120_000; // 2 minutes

export function useRateLimits(network: Network) {
  const [rateLimits, setRateLimits] = useState<NTTRateLimit[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchRateLimits = async () => {
      if (cancelled) return;
      const response = await axios.post<NTTRateLimit[]>(
        `${network.endpoint}/get-ntt-rate-limits`,
        {},
        {
          headers: {
            // This is required per the api specification
            // Without this, request returns in prometheus format
            Accept: 'application/json',
            // This is required as the method is protected by authentication for Grafana Metrics Integration
            // Ok to use a dummy token here as it's not a real security measure
            Authorization: 'Bearer bypass_grafana_gating',
          },
        }
      );

      if (cancelled || !response.data) return;
      setRateLimits(response.data);
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
