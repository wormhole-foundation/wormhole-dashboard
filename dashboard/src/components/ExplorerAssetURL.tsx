import { CHAIN_INFO_MAP } from '@wormhole-foundation/wormhole-monitor-common';
import { useCurrentEnvironment } from '../contexts/NetworkContext';
import {
  CHAIN_ID_ALGORAND,
  CHAIN_ID_NEAR,
  CHAIN_ID_TERRA2,
  ChainId,
  tryHexToNativeAssetString,
} from '@certusone/wormhole-sdk';
import { Link } from '@mui/material';

export function ExplorerAssetURL({ chain, assetAddr }: { chain: number; assetAddr: string }) {
  const network = useCurrentEnvironment();
  const chainInfo = CHAIN_INFO_MAP[network][chain];
  if (!chainInfo) return <>{assetAddr}</>;
  const chainId: ChainId = chainInfo.chainId;
  var tokenAddress: string = '';
  if (chainId === CHAIN_ID_ALGORAND || chainId === CHAIN_ID_NEAR || chainId === CHAIN_ID_TERRA2) {
    return <>{assetAddr}</>;
  }
  try {
    tokenAddress = tryHexToNativeAssetString(
      assetAddr.slice(2),
      CHAIN_INFO_MAP[network][chain]?.chainId
    );
  } catch (e) {
    console.log(e);
    tokenAddress = assetAddr;
  }

  const explorerString = chainInfo?.explorerStem;
  const url = `${explorerString}/address/${tokenAddress}`;
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer">
      {tokenAddress}
    </Link>
  );
}
