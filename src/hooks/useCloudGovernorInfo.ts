import axios from "axios";
import { useEffect, useState } from "react";
import { useNetworkContext } from "../contexts/NetworkContext";
import { JUMP_GUARDIAN_ADDRESS } from "../utils/consts";

export interface AvailableNotionalByChain {
  chainId: number;
  remainingAvailableNotional: {
    jump: string;
    min: string;
    max: string;
    avg: string;
  };
  notionalLimit: string;
  bigTransactionSize: string;
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
}

export interface CloudGovernorInfo {
  notionals: AvailableNotionalByChain[];
  tokens: GovernorToken[];
  enqueuedVAAs: EnqueuedVAA[];
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
});

const getInfo = async (endpoint: string): Promise<CloudGovernorInfo> => {
  const [configs, status] = await Promise.all([
    axios.get<GovernorConfigsResponse>(`${endpoint}/governor-configs`),
    axios.get<GovernorStatusResponse>(`${endpoint}/governor-status`),
  ]);

  let jumpConfig: GovernorConfig | undefined;
  const notionalsByChain = configs.data.governorConfigs.reduce<{
    [chainId: number]: bigint[];
  }>((notionalsByChain, config) => {
    if (config.guardianAddress.toLowerCase() === JUMP_GUARDIAN_ADDRESS)
      jumpConfig = config;
    config.chains.forEach(({ chainId, availableNotional }) => {
      if (notionalsByChain[chainId] === undefined) {
        notionalsByChain[chainId] = [];
      }
      notionalsByChain[chainId].push(BigInt(availableNotional));
    });
    return notionalsByChain;
  }, {});
  const notionals = jumpConfig
    ? jumpConfig.chains.map<AvailableNotionalByChain>((chain) => {
        const stats = (notionalsByChain[chain.chainId] || []).reduce<{
          min: bigint;
          max: bigint;
          sum: bigint;
        }>(
          (stats, notional) => {
            if (notional < stats.min) stats.min = notional;
            if (notional > stats.max) stats.max = notional;
            stats.sum += notional;
            return stats;
          },
          { min: BigInt(1e9), max: BigInt(-1e9), sum: BigInt(0) }
        );
        return {
          ...chain,
          remainingAvailableNotional: {
            jump: chain.availableNotional,
            min: stats.min.toString(),
            max: stats.max.toString(),
            avg: (
              stats.sum / BigInt(notionalsByChain[chain.chainId]?.length || 1)
            ).toString(),
          },
        };
      })
    : [];

  const tokens = jumpConfig?.tokens || [];

  const jumpStatus = status.data.governorStatus.find(
    (status) => status.guardianAddress.toLowerCase() === JUMP_GUARDIAN_ADDRESS
  );
  const enqueuedVAAs: EnqueuedVAA[] = [];
  (jumpStatus?.chains || []).forEach((chain) => {
    chain.emitters.forEach((emitter) => {
      emitter.enqueuedVaas.forEach((vaa) => {
        enqueuedVAAs.push({
          ...vaa,
          emitterChain: chain.chainId,
          emitterAddress: emitter.emitterAddress.slice(2),
        });
      });
    });
  });

  return {
    notionals,
    tokens,
    enqueuedVAAs,
  };
};

const useCloudGovernorInfo = (): CloudGovernorInfo => {
  const { currentNetwork } = useNetworkContext();
  const [governorInfo, setGovernorInfo] = useState<CloudGovernorInfo>(
    createEmptyInfo()
  );

  useEffect(() => {
    setGovernorInfo(createEmptyInfo());
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
