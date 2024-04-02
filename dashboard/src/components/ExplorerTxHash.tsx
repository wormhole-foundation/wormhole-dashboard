import { explorerTx, getExplorerTxHash } from '@wormhole-foundation/wormhole-monitor-common';
import { useCurrentEnvironment } from '../contexts/NetworkContext';
import { Link } from '@mui/material';
import { chainIdToChain, chainToChainId } from '@wormhole-foundation/sdk-base';

export function ExplorerTxHash({ chainId, rawTxHash }: { chainId: number; rawTxHash: string }) {
  const network = useCurrentEnvironment();
  const chain = chainIdToChain.get(chainId);
  if (!chain) return <>{rawTxHash}</>;
  const txHash = getExplorerTxHash(network, chainToChainId(chain), rawTxHash);
  return (
    <Link
      href={explorerTx(network, chainToChainId(chain), txHash)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {txHash}
    </Link>
  );
}
