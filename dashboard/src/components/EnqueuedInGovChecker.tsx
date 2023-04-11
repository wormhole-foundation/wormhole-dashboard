import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { PendingTransferKey } from '../hooks/useGetAccountantPendingTransfers';
import { MessageID, ChainID } from '@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc';
import axios from 'axios';
import { ethers } from "ethers";

function EnqueuedInGovChecker({
  transferKey: { emitter_chain, emitter_address, sequence },
}: {
  transferKey: PendingTransferKey;
}) {
  const { currentNetwork } = useNetworkContext();
  const [vaaIsEnqueued, setVaaIsEnqueued] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      setVaaIsEnqueued(null);
      let messageId: MessageID = {emitterChain: emitter_chain, emitterAddress: emitter_address, sequence: sequence.toString() };
      const isEnqueued = await isEnqueuedInGovernor(currentNetwork.endpoint, messageId);
      setVaaIsEnqueued(isEnqueued);
    })();
  }, [currentNetwork, emitter_chain, emitter_address, sequence]);
  return <span role="img">{vaaIsEnqueued === null ? '⏳' : vaaIsEnqueued ? '✅' : '❌'}</span>;
}

export default EnqueuedInGovChecker;

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

async function isEnqueuedInGovernor(endpoint: string, messageId: MessageID) {
  const [status] = await Promise.all([
    axios.get<GovernorStatusResponse>(`${endpoint}/governor-status`),
  ]);

  for (const st of status.data.governorStatus) {
    for (const chain of st.chains) {
      for (const emitter of chain.emitters) {
        let ea = ethers.utils.hexlify(emitter.emitterAddress, { allowMissingPrefix: true }).substring(2).padStart(64, "0");
        for (const vaa of emitter.enqueuedVaas) {
          if (chain.chainId as ChainID === messageId.emitterChain && ea === messageId.emitterAddress && vaa.sequence === messageId.sequence) {
            return true
          }
        }
      }
    }
  }

  return false;
}
