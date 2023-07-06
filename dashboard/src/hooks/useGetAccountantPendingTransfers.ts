import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { ACCOUNTANT_CONTRACT_ADDRESS, WORMCHAIN_URL } from '../utils/consts';

const POLL_INTERVAL_MS = 10 * 1000;
const PAGE_LIMIT = 2000; // throws a gas limit error over this

export type PendingTransferKey = {
  emitter_chain: number;
  emitter_address: string;
  sequence: number;
};

export type PendingTransfer = {
  key: PendingTransferKey;
  data: [
    {
      digest: string;
      tx_hash: string;
      signatures: string;
      guardian_set_index: number;
      emitter_chain: number;
    },
  ];
};

const useGetAccountantPendingTransfers = (): PendingTransfer[] => {
  const { currentNetwork } = useNetworkContext();
  const [accountantInfo, setAccountantInfo] = useState<PendingTransfer[]>([]);

  useEffect(() => {
    if (currentNetwork.name !== 'Mainnet') {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const cosmWasmClient = await CosmWasmClient.connect(WORMCHAIN_URL);
          let pending: PendingTransfer[] = [];
          let response;
          let start_after = undefined;
          do {
            response = await cosmWasmClient.queryContractSmart(
              ACCOUNTANT_CONTRACT_ADDRESS,
              {
                all_pending_transfers: {
                  limit: PAGE_LIMIT,
                  start_after,
                },
              }
            );
            pending = [...pending, ...response.pending];
            start_after =
              response.pending.length &&
              response.pending[response.pending.length - 1].key;
          } while (response.pending.length === PAGE_LIMIT);
          if (!cancelled) {
            setAccountantInfo(pending);
          }
        } catch (error) {
          if (!cancelled) {
            setAccountantInfo([]);
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
  }, [currentNetwork]);

  return accountantInfo;
};

export default useGetAccountantPendingTransfers;
