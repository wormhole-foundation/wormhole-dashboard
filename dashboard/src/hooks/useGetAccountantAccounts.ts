import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { TESTNET_WORMCHAIN_URL, WORMCHAIN_URL } from '../utils/consts';
import { queryContractSmart } from '@wormhole-foundation/wormhole-monitor-common/src/queryContractSmart';

const PAGE_LIMIT = 2000; // throws a gas limit error over this

export type Account = {
  key: {
    chain_id: number;
    token_chain: number;
    token_address: string;
  };
  balance: string;
};

export type AccountantAccountsResult = {
  accounts: Account[];
  receivedAt: string | null;
};

const useGetAccountantAccounts = (contractAddress: string): AccountantAccountsResult => {
  const { currentNetwork } = useNetworkContext();
  const [result, setResult] = useState<AccountantAccountsResult>({
    accounts: [],
    receivedAt: null,
  });

  useEffect(() => {
    setResult({ accounts: [], receivedAt: null });
    if (currentNetwork.name !== 'Mainnet' && currentNetwork.name !== 'Testnet') {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let accounts: Account[] = [];
        let response;
        let start_after = undefined;
        do {
          response = await queryContractSmart(
            currentNetwork.name === 'Mainnet' ? WORMCHAIN_URL : TESTNET_WORMCHAIN_URL,
            contractAddress,
            {
              all_accounts: {
                limit: PAGE_LIMIT,
                start_after,
              },
            }
          );
          accounts = [...accounts, ...response.accounts];
          start_after =
            response.accounts.length && response.accounts[response.accounts.length - 1].key;
        } while (response.accounts.length === PAGE_LIMIT);
        if (!cancelled) {
          setResult({ accounts, receivedAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork, contractAddress]);

  return result;
};

export default useGetAccountantAccounts;
