import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { getQuorumCount } from '../components/Alerts';
import { GUARDIAN_SET_4 } from '@wormhole-foundation/wormhole-monitor-common';

export interface AvailableNotionalByChain {
  guardianName?: string;
  chainId: number;
  remainingAvailableNotional: {
    min: string;
    max: string;
    quorum: string;
  };
  notionalLimit: string;
  bigTransactionSize: string;
  byGuardian?: AvailableNotionalByChain[];
}

export interface GovernorToken {
  originAddress: string;
  originChainId: number;
  price: number;
}

export interface EnqueuedVAA {
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
  releaseTime: number;
  notionalValue: string;
  txHash: string;
  byGuardian: {
    [guardianAddress: string]: EnqueuedVAAResponse;
  };
}

export interface TotalEnqueuedVaasByGuardianByChain {
  [guardianAddress: string]: {
    [chainId: number]: number;
  };
}

export interface CloudGovernorInfo {
  notionals: AvailableNotionalByChain[];
  tokens: GovernorToken[];
  enqueuedVAAs: EnqueuedVAA[];
  totalEnqueuedVaas: TotalEnqueuedVaasByGuardianByChain;
}

interface Chain {
  bigTransactionSize: string;
  chainId: number;
  notionalLimit: string;
  availableNotional: string;
}

interface GovernorConfig {
  chains: Chain[];
  guardianAddress: string;
  tokens: GovernorToken[];
  updatedAt: Date;
}

interface GovernorConfigsResponse {
  governorConfigs: GovernorConfig[];
}

interface EnqueuedVAAResponse {
  sequence: string;
  releaseTime: number;
  notionalValue: string;
  txHash: string;
}

interface Emitter {
  emitterAddress: string;
  enqueuedVaas: EnqueuedVAAResponse[];
  totalEnqueuedVaas: string;
}

interface ChainStatus {
  availableNotional: string;
  chainId: number;
  emitters: Emitter[];
}

interface GovernorStatus {
  chains: ChainStatus[];
  guardianAddress: string;
  updatedAt: Date;
}

interface GovernorStatusResponse {
  governorStatus: GovernorStatus[];
}

const POLL_INTERVAL_MS = 10 * 1000;

const createEmptyInfo = (): CloudGovernorInfo => ({
  notionals: [],
  tokens: [],
  enqueuedVAAs: [],
  totalEnqueuedVaas: {},
});

const getInfo = async (endpoint: string): Promise<CloudGovernorInfo> => {
  const [configs, status] = await Promise.all([
    axios.get<GovernorConfigsResponse>(`${endpoint}/governor-configs`),
    axios.get<GovernorStatusResponse>(`${endpoint}/governor-status`),
  ]);

  let firstConfig: GovernorConfig | undefined = undefined;
  const availableNotionalByChain: {
    [chainId: number]: bigint[];
  } = {};
  const bigTransactionSizeByChain: {
    [chainId: number]: bigint[];
  } = {};
  const notionalLimitsByChain: {
    [chainId: number]: bigint[];
  } = {};
  const guardiansByChain: {
    [chainId: number]: AvailableNotionalByChain[];
  } = {};
  for (const config of configs.data.governorConfigs) {
    if (
      config.guardianAddress.toLowerCase() === GUARDIAN_SET_4[0].pubkey.toLowerCase().substring(2)
    ) {
      firstConfig = config;
    }
    const guardianName =
      GUARDIAN_SET_4.find(
        (g) => `0x${config.guardianAddress}`.toLowerCase() === g.pubkey.toLowerCase()
      )?.name || config.guardianAddress;
    for (const chain of config.chains) {
      const { chainId, availableNotional, bigTransactionSize, notionalLimit } = chain;
      availableNotionalByChain[chainId] = [
        ...(availableNotionalByChain[chainId] || []),
        BigInt(availableNotional),
      ];
      bigTransactionSizeByChain[chainId] = [
        ...(bigTransactionSizeByChain[chainId] || []),
        BigInt(bigTransactionSize),
      ];
      notionalLimitsByChain[chainId] = [
        ...(notionalLimitsByChain[chainId] || []),
        BigInt(notionalLimit),
      ];
      guardiansByChain[chainId] = [
        ...(guardiansByChain[chainId] || []),
        {
          ...chain,
          guardianName,
          remainingAvailableNotional: {
            min: '',
            max: '',
            quorum: chain.availableNotional,
          },
        },
      ];
    }
  }

  const notionals: AvailableNotionalByChain[] = [];
  const quorumIdx = getQuorumCount('Mainnet') - 1;
  for (const chainIdStr in availableNotionalByChain) {
    const chainId = Number(chainIdStr);
    availableNotionalByChain[chainId].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).reverse();
    bigTransactionSizeByChain[chainId].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).reverse();
    notionalLimitsByChain[chainId].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).reverse();
    notionals.push({
      chainId,
      remainingAvailableNotional: {
        min: availableNotionalByChain[chainId][
          availableNotionalByChain[chainId].length - 1
        ].toString(),
        max: availableNotionalByChain[chainId][0].toString(),
        quorum:
          availableNotionalByChain[chainId][
            Math.min(quorumIdx, availableNotionalByChain[chainId].length - 1)
          ].toString(),
      },
      bigTransactionSize:
        bigTransactionSizeByChain[chainId][
          Math.min(quorumIdx, bigTransactionSizeByChain[chainId].length - 1)
        ].toString(),
      notionalLimit:
        notionalLimitsByChain[chainId][
          Math.min(quorumIdx, notionalLimitsByChain[chainId].length - 1)
        ].toString(),
      byGuardian: guardiansByChain[chainId],
    });
  }

  const tokens = firstConfig?.tokens || [];

  const vaaById: { [key: string]: EnqueuedVAA } = {};
  const totalEnqueuedVaas: TotalEnqueuedVaasByGuardianByChain = {};
  for (const s of status.data.governorStatus) {
    for (const chain of s.chains) {
      for (const emitter of chain.emitters) {
        if (!totalEnqueuedVaas[s.guardianAddress]) {
          totalEnqueuedVaas[s.guardianAddress] = {};
        }
        if (!totalEnqueuedVaas[s.guardianAddress][chain.chainId]) {
          totalEnqueuedVaas[s.guardianAddress][chain.chainId] = 0;
        }
        totalEnqueuedVaas[s.guardianAddress][chain.chainId] += Number(emitter.totalEnqueuedVaas);

        // NOTE: the enqueuedVaas list is limited to 20 VAAs
        for (const vaa of emitter.enqueuedVaas) {
          const emitterAddress = emitter.emitterAddress.slice(2);
          const vaaId = `${chain.chainId}/${emitterAddress}/${vaa.sequence}`;
          vaaById[vaaId] = {
            ...vaa,
            emitterChain: chain.chainId,
            emitterAddress,
            byGuardian: { ...(vaaById[vaaId]?.byGuardian || {}), [s.guardianAddress]: vaa },
          };
        }
      }
    }
  }

  const enqueuedVAAs = Object.values(vaaById);
  return {
    notionals,
    tokens,
    enqueuedVAAs,
    totalEnqueuedVaas,
  };
};

const useCloudGovernorInfo = (): CloudGovernorInfo => {
  const { currentNetwork } = useNetworkContext();
  const [governorInfo, setGovernorInfo] = useState<CloudGovernorInfo>(createEmptyInfo());

  useEffect(() => {
    setGovernorInfo(createEmptyInfo());
    if (currentNetwork.name !== 'Mainnet') {
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const info = await getInfo(currentNetwork.endpoint);
          info.notionals.sort((a, b) =>
            a.chainId < b.chainId ? -1 : a.chainId > b.chainId ? 1 : 0
          );
          if (!cancelled) {
            setGovernorInfo(info);
          }
        } catch (error) {
          if (!cancelled) {
            setGovernorInfo(createEmptyInfo());
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

  return governorInfo;
};

export default useCloudGovernorInfo;
