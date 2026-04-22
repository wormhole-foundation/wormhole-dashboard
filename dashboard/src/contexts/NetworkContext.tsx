import { Network as sdkNetwork } from '@wormhole-foundation/sdk-base';
import React, { ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

export type Environment = sdkNetwork;
export type Network = {
  env: Environment;
  endpoint: string;
  name: string;
  logo: string;
  type: 'guardian' | 'cloudfunction';
};

type NetworkContextValue = {
  currentNetwork: Network;
  setCurrentNetwork: (network: Network) => void;
};

// https://book.wormhole.com/reference/rpcnodes.html
// https://wormhole.com/security/
export const networkOptions: Network[] = [
  {
    env: 'Mainnet',
    endpoint: 'https://europe-west3-wormhole-message-db-mainnet.cloudfunctions.net',
    name: 'Mainnet',
    logo: '',
    type: 'cloudfunction',
  },
  {
    env: 'Mainnet',
    endpoint: 'https://wormhole-v2-mainnet-api.mcf.rocks',
    name: 'MCF',
    logo: '',
    type: 'guardian',
  },
  {
    env: 'Mainnet',
    endpoint: 'https://wormhole-v2-mainnet-api.chainlayer.network',
    name: 'ChainLayer',
    logo: '',
    type: 'guardian',
  },
  {
    env: 'Mainnet',
    endpoint: 'https://worm-dash-01.rockrpc.net',
    name: 'RockawayX',
    logo: '',
    type: 'guardian',
  },
  {
    env: 'Mainnet',
    endpoint: 'https://wormhole-v2-mainnet-api.staking.fund',
    name: 'Staking Fund',
    logo: '',
    type: 'guardian',
  },
  {
    env: 'Mainnet',
    endpoint: 'https://guardian.mainnet.xlabs.xyz',
    name: 'xLabs',
    logo: '',
    type: 'guardian',
  },
  {
    env: 'Testnet',
    endpoint: 'https://europe-west3-wormhole-message-db-testnet.cloudfunctions.net',
    name: 'Testnet',
    logo: '',
    type: 'cloudfunction',
  },
  // TODO: This endpoint is REST only. REST support will have to be implemented for the relevant calls
  // {
  //   env: 'Testnet',
  //   endpoint: 'https://guardian-testnet.labsapis.com',
  //   name: 'Testnet - WL',
  //   logo: '',
  //   type: 'guardian',
  // },
  {
    env: 'Devnet',
    endpoint: 'http://localhost:7071',
    name: 'Devnet',
    logo: '',
    type: 'guardian',
  },
  ...(import.meta.env.VITE_SHOW_LOCAL_ENDPOINTS === 'true'
    ? ([
        {
          env: 'Mainnet',
          endpoint: import.meta.env.VITE_LOCAL_ENDPOINT || 'http://localhost:8080',
          name: 'Local (Mainnet)',
          logo: '',
          type: 'cloudfunction',
        },
        {
          env: 'Testnet',
          endpoint: import.meta.env.VITE_LOCAL_ENDPOINT || 'http://localhost:8080',
          name: 'Local (Testnet)',
          logo: '',
          type: 'cloudfunction',
        },
      ] as Network[])
    : []),
];

const defaultNetwork: Network = networkOptions[0];
const urlParamKey = 'endpoint';

const NetworkContext = React.createContext<NetworkContextValue>({
  currentNetwork: defaultNetwork,
  setCurrentNetwork: () => {},
});

export const NetworkContextProvider = ({ children }: { children: ReactNode }) => {
  const { push, replace } = useHistory();
  const { search } = useLocation();
  const { urlParams, urlNetwork, currentNetwork } = useMemo(() => {
    const urlParams = new URLSearchParams(search);
    const urlNetwork = urlParams.get(urlParamKey);
    const currentNetwork =
      networkOptions.find((option) => option.name === urlNetwork) || defaultNetwork;
    return { urlParams, urlNetwork, currentNetwork };
  }, [search]);
  const setCurrentNetwork = useCallback(
    (network: Network, shouldReplace?: boolean) => {
      if (urlNetwork !== network.name) {
        urlParams.set(urlParamKey, network.name);
        if (shouldReplace) {
          replace({ search: urlParams.toString() });
        } else {
          push({ search: urlParams.toString() });
        }
      }
    },
    [urlNetwork, urlParams, replace, push]
  );
  useEffect(() => {
    // sync initial / bad param with drop down, this will do nothing when the current network matches
    setCurrentNetwork(currentNetwork, true);
  }, [currentNetwork, setCurrentNetwork]);
  const value = useMemo(
    () => ({ currentNetwork, setCurrentNetwork }),
    [currentNetwork, setCurrentNetwork]
  );
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetworkContext = () => useContext(NetworkContext);

export const useCurrentEnvironment = () => useContext(NetworkContext).currentNetwork.env;
