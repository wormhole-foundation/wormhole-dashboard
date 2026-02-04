import { Chain, Network, rpc } from '@wormhole-foundation/sdk-base';
import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';
import React, { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useNetworkContext } from './NetworkContext';

// Types matching the Solidity struct
export interface DelegatedGuardianSet {
  chainId: number; // uint16
  timestamp: number; // uint32
  threshold: number; // uint8
  keys: string[]; // address[]
}

export interface DelegatedGuardiansConfig {
  [chainId: number]: DelegatedGuardianSet;
}

type DelegatedGuardiansContextValue = {
  config: DelegatedGuardiansConfig;
  isChainDelegated: (chainId: number) => boolean;
  getDelegatedGuardianSet: (chainId: number) => DelegatedGuardianSet | undefined;
};

// Contract addresses by network (deployed on a single chain per network)
const DELEGATED_GUARDIANS_CONTRACTS: {
  [network in Network]?: { address: string; chain: Chain };
} = {
  Testnet: {
    address: '0x1e65cEa448bc3c25cA27A747d1D080F67520F1AD',
    chain: 'Sepolia',
  },
  // Mainnet will be added later
  // Mainnet: {
  //   address: '0x...',
  //   chain: 'Ethereum',
  // },
};

// Function selector for getConfig()
const GET_CONFIG_METHOD_ID = getMethodId('getConfig()');

const DelegatedGuardiansContext = React.createContext<DelegatedGuardiansContextValue>({
  config: {},
  isChainDelegated: () => false,
  getDelegatedGuardianSet: () => undefined,
});

export const DelegatedGuardiansContextProvider = ({ children }: { children: ReactNode }) => {
  const { currentNetwork } = useNetworkContext();
  const [config, setConfig] = useState<DelegatedGuardiansConfig>({});

  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      const network = currentNetwork.env;
      if (network !== 'Mainnet' && network !== 'Testnet') {
        setConfig({});
        return;
      }

      const result = await getDelegatedGuardiansConfig(network);
      if (cancelled) return;
      setConfig(result);
    };

    fetchConfig();

    return () => {
      cancelled = true;
    };
  }, [currentNetwork.env]);

  const value = useMemo<DelegatedGuardiansContextValue>(
    () => ({
      config,
      isChainDelegated: (chainId: number) => chainId in config,
      getDelegatedGuardianSet: (chainId: number) => config[chainId],
    }),
    [config]
  );

  return (
    <DelegatedGuardiansContext.Provider value={value}>
      {children}
    </DelegatedGuardiansContext.Provider>
  );
};

export const useDelegatedGuardiansContext = () => useContext(DelegatedGuardiansContext);

// Helper to check if a chain is delegated
export const useIsChainDelegated = (chainId: number) => {
  const { isChainDelegated } = useDelegatedGuardiansContext();
  return isChainDelegated(chainId);
};

// --- Data fetching logic ---

async function getDelegatedGuardiansConfig(
  network: 'Mainnet' | 'Testnet'
): Promise<DelegatedGuardiansConfig> {
  const contractConfig = DELEGATED_GUARDIANS_CONTRACTS[network];

  if (!contractConfig) {
    console.log(`DelegatedGuardians contract not configured for ${network}`);
    return {};
  }

  const rpcUrl = rpc.rpcAddress(network, contractConfig.chain);
  if (!rpcUrl) {
    console.error(`${network} ${contractConfig.chain} RPC URL not found in SDK`);
    return {};
  }

  try {
    const result = await callContractMethod(
      rpcUrl,
      contractConfig.address,
      GET_CONFIG_METHOD_ID
    );

    const guardianSets = decodeGetConfigResponse(result);

    // Convert array to map by chainId for easier lookup
    const config: DelegatedGuardiansConfig = {};
    for (const set of guardianSets) {
      config[set.chainId] = set;
    }

    return config;
  } catch (error) {
    console.error(`Failed to fetch DelegatedGuardians config for ${network}:`, error);
    return {};
  }
}

function decodeGetConfigResponse(data: string): DelegatedGuardianSet[] {
  if (!data || data === '0x') {
    return [];
  }

  const hex = data.slice(2);

  const readUint256 = (pos: number): bigint => {
    const slice = hex.slice(pos * 2, pos * 2 + 64);
    return BigInt('0x' + (slice || '0'));
  };

  const readAddress = (pos: number): string => {
    return '0x' + hex.slice(pos * 2 + 24, pos * 2 + 64);
  };

  const results: DelegatedGuardianSet[] = [];
  const arrayOffset = Number(readUint256(0));
  const arrayLength = Number(readUint256(arrayOffset));

  if (arrayLength === 0) {
    return [];
  }

  const structOffsetsStart = arrayOffset + 32;

  for (let i = 0; i < arrayLength; i++) {
    const structOffsetRelative = Number(readUint256(structOffsetsStart + i * 32));
    // Offsets are relative to where the offsets array starts (structOffsetsStart), not arrayOffset
    const structStart = structOffsetsStart + structOffsetRelative;

    const chainId = Number(readUint256(structStart));
    const timestamp = Number(readUint256(structStart + 32));
    const threshold = Number(readUint256(structStart + 64));

    const keysOffsetRelative = Number(readUint256(structStart + 96));
    const keysStart = structStart + keysOffsetRelative;
    const keysLength = Number(readUint256(keysStart));

    const keys: string[] = [];
    for (let j = 0; j < keysLength; j++) {
      const key = readAddress(keysStart + 32 + j * 32);
      keys.push(key);
    }

    results.push({ chainId, timestamp, threshold, keys });
  }

  return results;
}
