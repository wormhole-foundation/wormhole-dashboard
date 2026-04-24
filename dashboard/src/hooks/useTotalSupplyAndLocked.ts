import { useState, useEffect } from 'react';
import { Network } from '../contexts/NetworkContext';
import { NTTTotalSupplyAndLockedData } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';

export type TotalSupplyAndLockedResult = {
  totalSupplyAndLocked: NTTTotalSupplyAndLockedData[];
  receivedAt: string | null;
};

export function useTotalSupplyAndLocked(network: Network): TotalSupplyAndLockedResult {
  const [result, setResult] = useState<TotalSupplyAndLockedResult>({
    totalSupplyAndLocked: [],
    receivedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await axios.post<NTTTotalSupplyAndLockedData[]>(
        `${network.endpoint}/get-total-supply-and-locked`
      );
      if (!cancelled && response.data) {
        setResult({
          totalSupplyAndLocked: response.data,
          receivedAt: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  return result;
}
