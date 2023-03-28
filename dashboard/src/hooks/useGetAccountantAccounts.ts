import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { ACCOUNTANT_CONTRACT_ADDRESS } from '../utils/consts';

const POLL_INTERVAL_MS = 1 * 60 * 1000;
const PAGE_LIMIT = 2000; // throws a gas limit error over this

export type Account = {
  key: {
    chain_id: number;
    token_chain: number;
    token_address: string;
  };
  balance: string;
};

const useGetAccountantAccounts = (): Account[] => {
  const {
    settings: { wormchainUrl },
  } = useSettingsContext();
  const { currentNetwork } = useNetworkContext();
  const [accountantInfo, setAccountantInfo] = useState<Account[]>([]);

  useEffect(() => {
    if (currentNetwork.name !== 'Mainnet' || !wormchainUrl) {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const cosmWasmClient = await CosmWasmClient.connect(wormchainUrl);
          let accounts: Account[] = [];
          let response;
          let start_after = undefined;
          do {
            response = await cosmWasmClient.queryContractSmart(ACCOUNTANT_CONTRACT_ADDRESS, {
              all_accounts: {
                limit: PAGE_LIMIT,
                start_after,
              },
            });
            accounts = [...accounts, ...response.accounts];
            start_after =
              response.accounts.length && response.accounts[response.accounts.length - 1].key;
          } while (response.accounts.length === PAGE_LIMIT);
          if (!cancelled) {
            setAccountantInfo(accounts);
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

export default useGetAccountantAccounts;
