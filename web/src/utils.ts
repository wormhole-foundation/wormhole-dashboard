import {
  ChainId,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
} from '@certusone/wormhole-sdk/lib/esm/utils/consts';

export const explorerBlock = (chainId: ChainId, block: string) =>
  chainId === CHAIN_ID_ETH
    ? `https://etherscan.io/block/${block}`
    : chainId === CHAIN_ID_BSC
    ? `https://bscscan.com/block/${block}`
    : chainId === CHAIN_ID_POLYGON
    ? `https://polygonscan.com/block/${block}`
    : chainId === CHAIN_ID_AVAX
    ? `https://snowtrace.io/block/${block}`
    : chainId === CHAIN_ID_OASIS
    ? `https://explorer.emerald.oasis.dev/block/${block}`
    : chainId === CHAIN_ID_AURORA
    ? `https://aurorascan.dev/block/${block}`
    : chainId === CHAIN_ID_FANTOM
    ? `https://ftmscan.com/block/${block}`
    : chainId === CHAIN_ID_KLAYTN
    ? `https://scope.klaytn.com/block/${block}`
    : chainId === CHAIN_ID_CELO
    ? `https://explorer.celo.org/block/${block}`
    : chainId === CHAIN_ID_KARURA
    ? `https://"blockscout.karura.network/block/${block}`
    : chainId === CHAIN_ID_ACALA
    ? `https://blockscout.acala.network/block/${block}`
    : chainId === CHAIN_ID_SOLANA
    ? `https://solscan.io/block/${block}`
    : chainId === CHAIN_ID_TERRA
    ? `https://finder.terra.money/columbus-5/block/${block}`
    : chainId === CHAIN_ID_TERRA2
    ? `https://finder.terra.money/phoenix-1/block/${block}`
    : chainId === CHAIN_ID_ALGORAND
    ? `https://algoexplorer.io/block/${block}`
    : chainId === CHAIN_ID_NEAR
    ? `https://explorer.near.org/blocks/${block}`
    : chainId === CHAIN_ID_MOONBEAM
    ? `https://moonscan.io/block/${block}`
    : chainId === CHAIN_ID_XPLA
    ? `https://explorer.xpla.io/mainnet/block/${block}`
    : chainId === CHAIN_ID_APTOS
    ? `https://explorer.aptoslabs.com/block/${block}`
    : chainId === CHAIN_ID_ARBITRUM
    ? `https://arbiscan.io/block/${block}`
    : chainId === CHAIN_ID_INJECTIVE
    ? `https://explorer.injective.network/block/${block}`
    : '';

export const explorerTx = (chainId: ChainId, tx: string) =>
  chainId === CHAIN_ID_ETH
    ? `https://etherscan.io/tx/${tx}`
    : chainId === CHAIN_ID_BSC
    ? `https://bscscan.com/tx/${tx}`
    : chainId === CHAIN_ID_POLYGON
    ? `https://polygonscan.com/tx/${tx}`
    : chainId === CHAIN_ID_AVAX
    ? `https://snowtrace.io/tx/${tx}`
    : chainId === CHAIN_ID_OASIS
    ? `https://explorer.emerald.oasis.dev/tx/${tx}`
    : chainId === CHAIN_ID_AURORA
    ? `https://aurorascan.dev/tx/${tx}`
    : chainId === CHAIN_ID_FANTOM
    ? `https://ftmscan.com/tx/${tx}`
    : chainId === CHAIN_ID_KLAYTN
    ? `https://scope.klaytn.com/tx/${tx}`
    : chainId === CHAIN_ID_CELO
    ? `https://explorer.celo.org/tx/${tx}`
    : chainId === CHAIN_ID_KARURA
    ? `https://"blockscout.karura.network/tx/${tx}`
    : chainId === CHAIN_ID_ACALA
    ? `https://blockscout.acala.network/tx/${tx}`
    : chainId === CHAIN_ID_SOLANA
    ? `https://solscan.io/tx/${tx}`
    : chainId === CHAIN_ID_TERRA
    ? `https://finder.terra.money/columbus-5/tx/${tx}`
    : chainId === CHAIN_ID_TERRA2
    ? `https://finder.terra.money/phoenix-1/tx/${tx}`
    : chainId === CHAIN_ID_ALGORAND
    ? `https://algoexplorer.io/tx/${tx}`
    : chainId === CHAIN_ID_NEAR
    ? `https://explorer.near.org/transactions/${tx}`
    : chainId === CHAIN_ID_MOONBEAM
    ? `https://moonscan.io/tx/${tx}`
    : chainId === CHAIN_ID_XPLA
    ? `https://explorer.xpla.io/mainnet/tx/${tx}`
    : chainId === CHAIN_ID_APTOS
    ? `https://explorer.aptoslabs.com/txn/${tx}`
    : chainId === CHAIN_ID_ARBITRUM
    ? `https://arbiscan.io/tx/${tx}`
    : chainId === CHAIN_ID_INJECTIVE
    ? `https://explorer.injective.network/tx/${tx}`
    : '';

export const explorerVaa = (key: string) =>
  `https://wormhole.com/explorer/?emitterChain=${key.split('/')[0]}&emitterAddress=${
    key.split('/')[1]
  }&sequence=${key.split('/')[2]}`;
