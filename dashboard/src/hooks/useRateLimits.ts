import { useState, useEffect } from 'react';
import { Network } from '../contexts/NetworkContext';
import { NTTRateLimit } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

export type RateLimitsResult = {
  rateLimits: NTTRateLimit[];
  receivedAt: string | null;
};

export function useRateLimits(network: Network): RateLimitsResult {
  const [result, setResult] = useState<RateLimitsResult>({ rateLimits: [], receivedAt: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      setResult({ rateLimits: response.data, receivedAt: new Date().toISOString() });
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  return result;
}
