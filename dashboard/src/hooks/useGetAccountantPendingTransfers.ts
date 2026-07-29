import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { WORMCHAIN_URL } from '../utils/consts';
import { queryContractSmart } from '@wormhole-foundation/wormhole-monitor-common/src/queryContractSmart';

const POLL_INTERVAL_MS = 60 * 1000;
const PAGE_LIMIT = 2000; // throws a gas limit error over this

export type PendingTransferKey = {
  emitter_chain: number;
  emitter_address: string;
  sequence: number;
};

export type PendingTransferData = {
  digest: string;
  tx_hash: string;
  signatures: string;
  guardian_set_index: number;
  emitter_chain: number;
};

export type PendingTransfer = {
  key: PendingTransferKey;
  data: PendingTransferData[];
};

// A single flattened row of the pending transfers table: one entry from a
// pending transfer's `data` array combined with its key. The key is not unique
// across rows since a single key can have multiple pending data entries.
export type PendingTransferRow = PendingTransferKey & PendingTransferData;

export type AccountantPendingTransfersResult = {
  pendingTransfers: PendingTransferRow[];
  receivedAt: string | null;
};

const useGetAccountantPendingTransfers = (
  contractAddress: string
): AccountantPendingTransfersResult => {
  const { currentNetwork } = useNetworkContext();
  const [result, setResult] = useState<AccountantPendingTransfersResult>({
    pendingTransfers: [],
    receivedAt: null,
  });

  useEffect(() => {
    if (currentNetwork.name !== 'Mainnet') {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          let pending: PendingTransfer[] = [];
          let response;
          let start_after = undefined;
          do {
            response = await queryContractSmart(WORMCHAIN_URL, contractAddress, {
              all_pending_transfers: {
                limit: PAGE_LIMIT,
                start_after,
              },
            });
            pending = [...pending, ...response.pending];
            start_after =
              response.pending.length && response.pending[response.pending.length - 1].key;
          } while (response.pending.length === PAGE_LIMIT);
          // Flatten each pending transfer into one row per data entry so the
          // table shows a line for every entry rather than just the first.
          const rows: PendingTransferRow[] = pending.flatMap((pt) =>
            pt.data.map((d) => ({ ...pt.key, ...d }))
          );
          if (!cancelled) {
            setResult({ pendingTransfers: rows, receivedAt: new Date().toISOString() });
          }
        } catch (error) {
          if (!cancelled) {
            setResult({ pendingTransfers: [], receivedAt: null });
          }
          console.error(error);
        }
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork, contractAddress]);

  return result;
};

export default useGetAccountantPendingTransfers;
