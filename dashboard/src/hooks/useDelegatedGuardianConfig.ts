import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const DELEGATED_GUARDIAN_CONTRACT = '0x1462800febd49232798132e8c8b721aa86c4c209' as const;

const abi = [
  {
    name: 'getConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'chainId', type: 'uint16' },
          { name: 'timestamp', type: 'uint32' },
          { name: 'threshold', type: 'uint8' },
          { name: 'keys', type: 'address[]' },
        ],
      },
    ],
  },
] as const;

export type DelegatedGuardianConfig = {
  chainId: number;
  threshold: number;
  numGuardians: number;
  keys: string[];
};

export type DelegatedGuardianConfigMap = {
  [chainId: number]: DelegatedGuardianConfig;
};

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
});

function useDelegatedGuardianConfig(): DelegatedGuardianConfigMap {
  const [config, setConfig] = useState<DelegatedGuardianConfigMap>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchConfig() {
      try {
        const result = await client.readContract({
          address: DELEGATED_GUARDIAN_CONTRACT,
          abi,
          functionName: 'getConfig',
        });

        if (cancelled) return;

        const configMap: DelegatedGuardianConfigMap = {};
        for (const entry of result) {
          configMap[entry.chainId] = {
            chainId: entry.chainId,
            threshold: entry.threshold,
            numGuardians: entry.keys.length,
            keys: entry.keys.map((k) => k.toLowerCase()),
          };
        }
        setConfig(configMap);
      } catch (e) {
        console.error('Failed to fetch delegated guardian config:', e);
      }
    }

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

export default useDelegatedGuardianConfig;
