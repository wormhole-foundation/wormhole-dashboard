import { ChainId, chainToChainId } from '@wormhole-foundation/sdk-base';
import { CHAIN_INFO_MAP } from '@wormhole-foundation/wormhole-monitor-common';
import { useCurrentEnvironment } from '../contexts/NetworkContext';

export function ExplorerAssetURL({ chain, assetAddr }: { chain: number; assetAddr: string }) {
  const network = useCurrentEnvironment();
  const chainInfo = CHAIN_INFO_MAP[network][chain];
  if (!chainInfo) return <>{assetAddr}</>;
  const chainId: ChainId = chainInfo.chainId;
  // var tokenAddress: string = '';
  if (
    chainId === chainToChainId('Algorand') ||
    chainId === chainToChainId('Near') ||
    chainId === chainToChainId('Terra2')
  ) {
    return <>{assetAddr}</>;
  }
  return <>{assetAddr}</>;
  // try {
  //   tokenAddress = Wormhole.tokenId(
  //     chainIdToChain(chainId),
  //     assetAddr,
  //   );
  // } catch (e) {
  //   console.log(e);
  //   tokenAddress = assetAddr;
  // }

  // const explorerString = chainInfo?.explorerStem;
  // const url = `${explorerString}/address/${tokenAddress}`;
  // return (
  //   <Link href={url} target="_blank" rel="noopener noreferrer">
  //     {tokenAddress}
  //   </Link>
  // );
}
