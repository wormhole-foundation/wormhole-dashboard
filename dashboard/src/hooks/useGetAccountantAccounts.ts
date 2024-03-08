import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { TESTNET_WORMCHAIN_URL, WORMCHAIN_URL } from '../utils/consts';

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

const useGetAccountantAccounts = (contractAddress: string): Account[] => {
  const { currentNetwork } = useNetworkContext();
  const [accountantInfo, setAccountantInfo] = useState<Account[]>([]);

  useEffect(() => {
    if (currentNetwork.name !== 'Mainnet' && currentNetwork.name !== 'Testnet') {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const cosmWasmClient = await CosmWasmClient.connect(
            currentNetwork.name === 'Mainnet' ? WORMCHAIN_URL : TESTNET_WORMCHAIN_URL
          );
          let accounts: Account[] = [];
          let response;
          let start_after = undefined;
          do {
            response = await cosmWasmClient.queryContractSmart(contractAddress, {
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
  }, [currentNetwork, contractAddress]);

  return accountantInfo;
};

export default useGetAccountantAccounts;
