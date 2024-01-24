import {
  CHAIN_INFO_MAP,
  explorerTx,
  getExplorerTxHash,
} from '@wormhole-foundation/wormhole-monitor-common';
import { useCurrentEnvironment } from '../contexts/NetworkContext';
import { Link } from '@mui/material';

export function ExplorerTxHash({ chain, rawTxHash }: { chain: number; rawTxHash: string }) {
  const network = useCurrentEnvironment();
  const chainInfo = CHAIN_INFO_MAP[network][chain];
  if (!chainInfo) return <>{rawTxHash}</>;
  const txHash = getExplorerTxHash(network, chainInfo.chainId, rawTxHash);
  return (
    <Link
      href={explorerTx(network, chainInfo.chainId, txHash)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {txHash}
    </Link>
  );
}
