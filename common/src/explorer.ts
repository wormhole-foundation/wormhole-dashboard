import {
  CHAIN_ID_WORMCHAIN,
  isCosmWasmChain,
  isEVMChain,
  tryHexToNativeString,
} from '@certusone/wormhole-sdk';
import {
  ChainId,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BASE,
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
  CHAIN_ID_SUI,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
} from '@certusone/wormhole-sdk';
import { base58 } from 'ethers/lib/utils';
import { CHAIN_INFO_MAP, Environment } from './consts';

export const explorerBlock = (network: Environment, chainId: ChainId, block: string) =>
  network === 'mainnet'
    ? chainId === CHAIN_ID_ETH
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
      ? `https://blockscout.karura.network/block/${block}`
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
      : chainId === CHAIN_ID_SUI
      ? `https://suiexplorer.com/checkpoint/${block}`
      : chainId === CHAIN_ID_BASE
      ? `https://basescan.org/block/${block}`
      : chainId === CHAIN_ID_WORMCHAIN
      ? `https://bigdipper.live/wormhole/blocks/${block}`
      : ''
    : chainId === CHAIN_ID_ETH
    ? `https://sepolia.etherscan.io/block/${block}`
    : chainId === CHAIN_ID_BSC
    ? `https://testnet.bscscan.com/block/${block}`
    : chainId === CHAIN_ID_POLYGON
    ? `https://mumbai.polygonscan.com/block/${block}`
    : chainId === CHAIN_ID_AVAX
    ? `https://testnet.snowtrace.io/block/${block}`
    : chainId === CHAIN_ID_OASIS
    ? `https://testnet.oasisscan.com/block/${block}`
    : chainId === CHAIN_ID_FANTOM
    ? `https://testnet.ftmscan.com/block/${block}`
    : chainId === CHAIN_ID_KLAYTN
    ? `https://baobab.klaytnscope.com/block/${block}`
    : chainId === CHAIN_ID_CELO
    ? `https://alfajores.celoscan.io/block/${block}`
    : chainId === CHAIN_ID_ACALA
    ? `https://blockscout.mandala.aca-staging.network/block/${block}`
    : chainId === CHAIN_ID_SOLANA
    ? `https://explorer.solana.com/${block}?cluster=testnet`
    : chainId === CHAIN_ID_ALGORAND
    ? `https://testnet.algoexplorer.io/block/${block}`
    : chainId === CHAIN_ID_MOONBEAM
    ? `https://moonbase.moonscan.io/block/${block}`
    : chainId === CHAIN_ID_XPLA
    ? `https://explorer.xpla.io/testnet/block/${block}`
    : chainId === CHAIN_ID_APTOS
    ? `https://explorer.aptoslabs.com/block/${block}?network=testnet`
    : chainId === CHAIN_ID_ARBITRUM
    ? `https://sepolia.arbiscan.io/block/${block}`
    : chainId === CHAIN_ID_SUI
    ? `https://suiexplorer.com/checkpoint/${block}?network=testnet`
    : chainId === CHAIN_ID_BASE
    ? `https://goerli.basescan.org/block/${block}`
    : '';

export const explorerTx = (network: Environment, chainId: ChainId, tx: string) =>
  network === 'mainnet'
    ? chainId === CHAIN_ID_ETH
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
      ? `https://blockscout.karura.network/tx/${tx}`
      : chainId === CHAIN_ID_ACALA
      ? `https://blockscout.acala.network/tx/${tx}`
      : chainId === CHAIN_ID_SOLANA
      ? `https://solscan.io/account/${tx}`
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
      ? `https://explorer.injective.network/transaction/${tx}`
      : chainId === CHAIN_ID_SUI
      ? `https://suiexplorer.com/txblock/${tx}`
      : chainId === CHAIN_ID_BASE
      ? `https://basescan.org/tx/${tx}`
      : chainId === CHAIN_ID_WORMCHAIN
      ? `https://bigdipper.live/wormhole/transactions/${tx}`
      : ''
    : chainId === CHAIN_ID_ETH
    ? `https://sepolia.etherscan.io/tx/${tx}`
    : chainId === CHAIN_ID_BSC
    ? `https://testnet.bscscan.com/tx/${tx}`
    : chainId === CHAIN_ID_POLYGON
    ? `https://mumbai.polygonscan.com/tx/${tx}`
    : chainId === CHAIN_ID_AVAX
    ? `https://testnet.snowtrace.io/tx/${tx}`
    : chainId === CHAIN_ID_OASIS
    ? `https://testnet.oasisscan.com/tx/${tx}`
    : chainId === CHAIN_ID_FANTOM
    ? `https://testnet.ftmscan.com/tx/${tx}`
    : chainId === CHAIN_ID_KLAYTN
    ? `https://baobab.klaytnscope.com/tx/${tx}`
    : chainId === CHAIN_ID_CELO
    ? `https://alfajores.celoscan.io/tx/${tx}`
    : chainId === CHAIN_ID_ACALA
    ? `https://blockscout.mandala.aca-staging.network/tx/${tx}`
    : chainId === CHAIN_ID_SOLANA
    ? `https://solscan.io/account/${tx}?cluster=testnet`
    : chainId === CHAIN_ID_ALGORAND
    ? `https://testnet.algoexplorer.io/tx/${tx}`
    : chainId === CHAIN_ID_MOONBEAM
    ? `https://moonbase.moonscan.io/tx/${tx}`
    : chainId === CHAIN_ID_XPLA
    ? `https://explorer.xpla.io/testnet/tx/${tx}`
    : chainId === CHAIN_ID_APTOS
    ? `https://explorer.aptoslabs.com/txn/${tx}?network=testnet`
    : chainId === CHAIN_ID_ARBITRUM
    ? `https://sepolia.arbiscan.io/tx/${tx}`
    : chainId === CHAIN_ID_SUI
    ? `https://suiexplorer.com/txblock/${tx}?network=testnet`
    : chainId === CHAIN_ID_BASE
    ? `https://goerli.basescan.org/tx/${tx}`
    : '';

export const explorerVaa = (network: string, key: string) =>
  network === 'mainnet'
    ? `https://wormholescan.io/#/tx/${key}`
    : `https://wormholescan.io/#/tx/${key}?network=TESTNET`;

export const getExplorerTxHash = (network: Environment, chain: ChainId, txHash: string) => {
  let explorerTxHash = '';
  if (isCosmWasmChain(chain)) {
    explorerTxHash = txHash.slice(2);
  } else if (chain === CHAIN_ID_SUI) {
    const txHashBytes = Buffer.from(txHash.slice(2), 'hex');
    explorerTxHash = base58.encode(txHashBytes);
  } else if (!isEVMChain(chain)) {
    try {
      explorerTxHash = tryHexToNativeString(
        txHash.slice(2),
        CHAIN_INFO_MAP[network][chain].chainId
      );
    } catch (e) {
      return txHash;
    }
  } else {
    explorerTxHash = txHash;
  }
  return explorerTxHash;
};
