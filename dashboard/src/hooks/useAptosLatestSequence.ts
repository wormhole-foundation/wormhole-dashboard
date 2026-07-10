import { contracts } from '@wormhole-foundation/sdk-base';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Environment } from '../contexts/NetworkContext';
import { APTOS_RPC_BY_NETWORK } from '../utils/consts';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

// The Aptos watcher is event-driven: it only records a "block" when a Wormhole
// message occurs, so its stored last-block timestamp can be days old during
// quiet periods even while the watcher is perfectly healthy. To tell "quiet"
// apart from "stuck", fetch the latest on-chain Wormhole event sequence number
// and let the caller compare it against the sequence the watcher has processed.
//
// Only enable this when Aptos already looks stale, to avoid an extra RPC call on
// every poll during normal operation.
const useAptosLatestSequence = (env: Environment, enabled: boolean): number | null => {
  const [latestSequence, setLatestSequence] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setLatestSequence(null);
      return;
    }
    const rpc = APTOS_RPC_BY_NETWORK[env];
    const coreBridge = contracts.coreBridge.get(env, 'Aptos');
    if (!rpc || !coreBridge) {
      setLatestSequence(null);
      return;
    }
    // Mirrors the watcher's getFinalizedBlockNumber: omitting `start` returns the
    // most recent events for this handle, so limit=1 yields the latest message.
    const eventHandle = `${coreBridge}::state::WormholeMessageHandle`;
    const url = `${rpc}/v1/accounts/${coreBridge}/events/${eventHandle}/event?limit=1`;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const response = await axios.get<{ sequence_number: string }[]>(url);
          const seq = response.data?.[0]?.sequence_number;
          if (!cancelled && seq !== undefined) {
            setLatestSequence(Number(seq));
          }
        } catch (e) {
          // Leave the last known value in place on transient RPC errors.
        }
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env, enabled]);
  return latestSequence;
};

export default useAptosLatestSequence;
