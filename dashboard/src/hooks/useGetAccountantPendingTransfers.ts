import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { useEffect, useState } from "react";
import { useNetworkContext } from "../contexts/NetworkContext";
import { useSettingsContext } from "../contexts/SettingsContext";
import { ACCOUNTANT_CONTRACT_ADDRESS } from "../utils/consts";

const POLL_INTERVAL_MS = 10 * 1000;

export type PendingTransfer = {
  key: {
    emitter_chain: number;
    emitter_address: string;
    sequence: number;
  };
  data: [
    {
      digest: string;
      tx_hash: string;
      signatures: string;
      guardian_set_index: number;
      emitter_chain: number;
    }
  ];
};

const useGetAccountantPendingTransfers = (): PendingTransfer[] => {
  const {
    settings: { wormchainUrl },
  } = useSettingsContext();
  const { currentNetwork } = useNetworkContext();
  const [accountantInfo, setAccountantInfo] = useState<PendingTransfer[]>([]);

  useEffect(() => {
    if (currentNetwork.name !== "Mainnet" || !wormchainUrl) {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const cosmWasmClient = await CosmWasmClient.connect(wormchainUrl);
          const response = await cosmWasmClient.queryContractSmart(
            ACCOUNTANT_CONTRACT_ADDRESS,
            {
              all_pending_transfers: {},
            }
          );
          if (!cancelled) {
            setAccountantInfo(response.pending);
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
  }, [currentNetwork, wormchainUrl]);

  return accountantInfo;
};

export default useGetAccountantPendingTransfers;
