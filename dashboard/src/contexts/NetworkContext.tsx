import React, { ReactNode, useContext, useMemo, useState } from "react";

export type Network = "mainnet" | "testnet" | "devnet";

type NetworkContextValue = {
  currentNetwork: Network;
  setCurrentNetwork: React.Dispatch<React.SetStateAction<Network>>;
};

const NetworkContext = React.createContext<NetworkContextValue>({
  currentNetwork: "mainnet",
  setCurrentNetwork: () => {},
});

export const NetworkContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [currentNetwork, setCurrentNetwork] = useState<Network>("mainnet");
  const value = useMemo(
    () => ({ currentNetwork, setCurrentNetwork }),
    [currentNetwork, setCurrentNetwork]
  );
  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetworkContext = () => {
  return useContext(NetworkContext);
};
