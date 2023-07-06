import {
  ChainId,
  getSignedVAA,
  getSignedVAAWithRetry,
} from '@certusone/wormhole-sdk';
import { GovernorGetEnqueuedVAAsResponse_Entry } from '@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';

const VAA_CHECK_TIMEOUT = 60000;
const WORMHOLE_RPC_HOSTS = [
  'https://wormhole-v2-mainnet-api.certus.one',
  'https://wormhole.inotel.ro',
  'https://wormhole-v2-mainnet-api.mcf.rocks',
];

function EnqueuedVAAChecker({
  vaa: { emitterAddress, emitterChain, sequence },
}: {
  vaa: GovernorGetEnqueuedVAAsResponse_Entry;
}) {
  const {
    currentNetwork: { endpoint, type },
  } = useNetworkContext();
  const [vaaHasQuorum, setVaaHasQuorum] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        setVaaHasQuorum(null);
        let result = false;

        if (type === 'cloudfunction') {
          try {
            const response = await getSignedVAAWithRetry(
              WORMHOLE_RPC_HOSTS,
              emitterChain as ChainId,
              emitterAddress,
              sequence,
              {},
              1000,
              3
            );
            if (!!response.vaaBytes) result = true;
          } catch (e) {}
        } else {
          try {
            const response = await getSignedVAA(
              endpoint,
              emitterChain as ChainId,
              emitterAddress,
              sequence
            );
            if (!!response.vaaBytes) result = true;
          } catch (e) {}
        }

        if (!cancelled) {
          setVaaHasQuorum(result);
          if (result) {
            cancelled = true;
            return;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, VAA_CHECK_TIMEOUT)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, type, emitterChain, emitterAddress, sequence]);
  return (
    <span role="img">
      {vaaHasQuorum === null ? '⏳' : vaaHasQuorum ? '✅' : '❌'}
    </span>
  );
}

export default EnqueuedVAAChecker;
