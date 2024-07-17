import { Chain, chainToPlatform, rpc } from '@wormhole-foundation/sdk-base';
import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';

function useGetGuardianSet(chain: Chain, address: string | undefined) {
  const network = useNetworkContext();
  const [guardianSet, setGuardianSet] = useState<[bigint | null, string | null]>([null, null]);
  useEffect(() => {
    setGuardianSet([null, null]);
    if (!address) return;
    const rpcUrl = rpc.rpcAddress('Mainnet', chain);
    if (!rpcUrl) return;
    let cancelled = false;
    const platform = chainToPlatform(chain);
    if (platform === 'Evm') {
      (async () => {
        try {
          const gsi = await callContractMethod(
            rpcUrl,
            address,
            getMethodId('getCurrentGuardianSetIndex()')
          );
          if (cancelled) return;
          const gs = await callContractMethod(
            rpcUrl,
            address,
            getMethodId('getGuardianSet(uint32)'),
            gsi.substring(2) // strip 0x
          );
          if (cancelled) return;
          setGuardianSet([BigInt(gsi), gs]);
        } catch (e) {}
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [network.currentNetwork.env, chain, address]);
  return guardianSet;
}

export default useGetGuardianSet;
