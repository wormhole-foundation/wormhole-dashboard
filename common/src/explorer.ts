import {
  ChainId,
  chainIdToChain,
  chainToChainId,
  chainToPlatform,
} from '@wormhole-foundation/sdk-base';
import base58 from 'bs58';
import { Buffer } from 'buffer';
import { Environment } from './consts';

export const explorerBlock = (network: Environment, chainId: ChainId, block: string) =>
  network === 'mainnet'
    ? chainId === chainToChainId('Solana')
      ? `https://solana.fm/block/${block}`
      : chainId === chainToChainId('Ethereum')
      ? `https://etherscan.io/block/${block}`
      : chainId === chainToChainId('Terra')
      ? `https://finder.terra.money/columbus-5/block/${block}`
      : chainId === chainToChainId('Bsc')
      ? `https://bscscan.com/block/${block}`
      : chainId === chainToChainId('Polygon')
      ? `https://polygonscan.com/block/${block}`
      : chainId === chainToChainId('Avalanche')
      ? `https://snowtrace.io/block/${block}`
      : chainId === chainToChainId('Oasis')
      ? `https://explorer.emerald.oasis.dev/block/${block}`
      : chainId === chainToChainId('Algorand')
      ? `https://app.dappflow.org/explorer/block/${block}`
      : chainId === chainToChainId('Fantom')
      ? `https://ftmscan.com/block/${block}`
      : chainId === chainToChainId('Karura')
      ? `https://blockscout.karura.network/block/${block}`
      : chainId === chainToChainId('Acala')
      ? `https://blockscout.acala.network/block/${block}`
      : chainId === chainToChainId('Klaytn')
      ? `https://scope.klaytn.com/block/${block}`
      : chainId === chainToChainId('Celo')
      ? `https://explorer.celo.org/block/${block}`
      : chainId === chainToChainId('Near')
      ? `https://nearblocks.io/blocks/${block}`
      : chainId === chainToChainId('Moonbeam')
      ? `https://moonscan.io/block/${block}`
      : chainId === chainToChainId('Terra2')
      ? `https://finder.terra.money/phoenix-1/block/${block}`
      : chainId === chainToChainId('Injective')
      ? `https://explorer.injective.network/block/${block}`
      : chainId === chainToChainId('Sui')
      ? `https://suiexplorer.com/checkpoint/${block}`
      : chainId === chainToChainId('Aptos')
      ? `https://explorer.aptoslabs.com/block/${block}`
      : chainId === chainToChainId('Arbitrum')
      ? `https://arbiscan.io/block/${block}`
      : chainId === chainToChainId('Optimism')
      ? `https://optimistic.etherscan.io/block/${block}`
      : chainId === chainToChainId('Xpla')
      ? `https://explorer.xpla.io/mainnet/block/${block}`
      : chainId === chainToChainId('Base')
      ? `https://basescan.org/block/${block}`
      : chainId === chainToChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/blocks/${block}`
      : chainId === chainToChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/blocks/${block}`
      : ''
    : chainId === chainToChainId('Solana')
    ? `https://explorer.solana.com/${block}?cluster=testnet`
    : chainId === chainToChainId('Ethereum')
    ? `https://sepolia.etherscan.io/block/${block}`
    : // : chainId === chainToChainId('Terra') <-- not supported on testnet dashboard
    chainId === chainToChainId('Bsc')
    ? `https://testnet.bscscan.com/block/${block}`
    : chainId === chainToChainId('Polygon')
    ? `https://mumbai.polygonscan.com/block/${block}`
    : chainId === chainToChainId('Avalanche')
    ? `https://testnet.snowtrace.io/block/${block}`
    : chainId === chainToChainId('Oasis')
    ? `https://testnet.oasisscan.com/block/${block}`
    : chainId === chainToChainId('Algorand')
    ? `https://app.dappflow.org/explorer/block/${block}`
    : chainId === chainToChainId('Fantom')
    ? `https://testnet.ftmscan.com/block/${block}`
    : // : chainId === chainToChainId('Karura') <-- not supported on testnet dashboard
    chainId === chainToChainId('Acala')
    ? `https://blockscout.mandala.aca-staging.network/block/${block}`
    : chainId === chainToChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/block/${block}`
    : chainId === chainToChainId('Celo')
    ? `https://alfajores.celoscan.io/block/${block}`
    : // : chainId === chainToChainId('Near') <-- not supported on testnet dashboard
    chainId === chainToChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/block/${block}`
    : // : chainId === chainToChainId('Terra2') <-- not supported on testnet dashboard
    // : chainId === chainToChainId('Injective') <-- not supported on testnet dashboard
    chainId === chainToChainId('Sui')
    ? `https://suiexplorer.com/checkpoint/${block}?network=testnet`
    : chainId === chainToChainId('Aptos')
    ? `https://explorer.aptoslabs.com/block/${block}?network=testnet`
    : chainId === chainToChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/block/${block}`
    : chainId === chainToChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/block/${block}`
    : chainId === chainToChainId('Xpla')
    ? `https://explorer.xpla.io/testnet/block/${block}`
    : chainId === chainToChainId('Base')
    ? `https://goerli.basescan.org/block/${block}`
    : chainId === chainToChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/blocks/${block}`
    : // : chainId === chainToChainId('Wormscan') <-- not supported on testnet dashboard
      '';

export const explorerTx = (network: Environment, chainId: ChainId, tx: string) =>
  network === 'mainnet'
    ? chainId === chainToChainId('Solana')
      ? `https://solana.fm/tx/${tx}`
      : chainId === chainToChainId('Ethereum')
      ? `https://etherscan.io/tx/${tx}`
      : chainId === chainToChainId('Terra')
      ? `https://finder.terra.money/columbus-5/tx/${tx}`
      : chainId === chainToChainId('Bsc')
      ? `https://bscscan.com/tx/${tx}`
      : chainId === chainToChainId('Polygon')
      ? `https://polygonscan.com/tx/${tx}`
      : chainId === chainToChainId('Avalanche')
      ? `https://snowtrace.io/tx/${tx}`
      : chainId === chainToChainId('Oasis')
      ? `https://explorer.emerald.oasis.dev/tx/${tx}`
      : chainId === chainToChainId('Algorand')
      ? `https://app.dappflow.org/explorer/transaction/${tx}`
      : chainId === chainToChainId('Fantom')
      ? `https://ftmscan.com/tx/${tx}`
      : chainId === chainToChainId('Karura')
      ? `https://blockscout.karura.network/tx/${tx}`
      : chainId === chainToChainId('Acala')
      ? `https://blockscout.acala.network/tx/${tx}`
      : chainId === chainToChainId('Klaytn')
      ? `https://scope.klaytn.com/tx/${tx}`
      : chainId === chainToChainId('Celo')
      ? `https://explorer.celo.org/tx/${tx}`
      : chainId === chainToChainId('Near')
      ? `https://explorer.near.org/transactions/${tx}`
      : chainId === chainToChainId('Moonbeam')
      ? `https://moonscan.io/tx/${tx}`
      : chainId === chainToChainId('Terra2')
      ? `https://finder.terra.money/phoenix-1/tx/${tx}`
      : chainId === chainToChainId('Injective')
      ? `https://explorer.injective.network/transaction/${tx}`
      : chainId === chainToChainId('Sui')
      ? `https://suiexplorer.com/txblock/${tx}`
      : chainId === chainToChainId('Aptos')
      ? `https://explorer.aptoslabs.com/txn/${tx}?network=mainnet`
      : chainId === chainToChainId('Arbitrum')
      ? `https://arbiscan.io/tx/${tx}`
      : chainId === chainToChainId('Optimism')
      ? `https://optimistic.etherscan.io/tx/${tx}`
      : chainId === chainToChainId('Xpla')
      ? `https://explorer.xpla.io/mainnet/tx/${tx}`
      : chainId === chainToChainId('Base')
      ? `https://basescan.org/tx/${tx}`
      : chainId === chainToChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/txs/${tx}`
      : chainId === chainToChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/transactions/${tx}`
      : ''
    : chainId === chainToChainId('Solana')
    ? `https://solscan.io/txs/${tx}?cluster=testnet`
    : chainId === chainToChainId('Ethereum')
    ? `https://sepolia.etherscan.io/tx/${tx}`
    : // : chainId === chainToChainId('Terra') <-- not supported on testnet dashboard
    chainId === chainToChainId('Bsc')
    ? `https://testnet.bscscan.com/tx/${tx}`
    : chainId === chainToChainId('Polygon')
    ? `https://mumbai.polygonscan.com/tx/${tx}`
    : chainId === chainToChainId('Avalanche')
    ? `https://testnet.snowtrace.io/tx/${tx}`
    : chainId === chainToChainId('Oasis')
    ? `https://testnet.oasisscan.com/tx/${tx}`
    : chainId === chainToChainId('Algorand')
    ? `https://app.dappflow.org/explorer/transaction/${tx}`
    : chainId === chainToChainId('Fantom')
    ? `https://testnet.ftmscan.com/tx/${tx}`
    : // chainId === chainToChainId('Karura') <-- not supported on testnet dashboard
    chainId === chainToChainId('Acala')
    ? `https://blockscout.mandala.aca-staging.network/tx/${tx}`
    : chainId === chainToChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/tx/${tx}`
    : chainId === chainToChainId('Celo')
    ? `https://alfajores.celoscan.io/tx/${tx}`
    : //  chainId === chainToChainId('Near') <-- not supported on testnet dashboard
    chainId === chainToChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/tx/${tx}`
    : // chainId === chainToChainId('Terra2') <-- not supported on testnet dashboard
    // chainId === chainToChainId('Injective') <-- not supported on testnet dashboard
    chainId === chainToChainId('Sui')
    ? `https://suiexplorer.com/txblock/${tx}?network=testnet`
    : chainId === chainToChainId('Aptos')
    ? `https://explorer.aptoslabs.com/txn/${tx}?network=testnet`
    : chainId === chainToChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/tx/${tx}`
    : chainId === chainToChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/tx/${tx}`
    : chainId === chainToChainId('Xpla')
    ? `https://explorer.xpla.io/testnet/tx/${tx}`
    : chainId === chainToChainId('Base')
    ? `https://goerli.basescan.org/tx/${tx}`
    : chainId === chainToChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/txs/${tx}`
    : // chainId === chainToChainId('Wormscan') <-- not supported on testnet dashboard
      '';

export const explorerVaa = (network: string, key: string) =>
  network === 'mainnet'
    ? `https://wormholescan.io/#/tx/${key}`
    : `https://wormholescan.io/#/tx/${key}?network=TESTNET`;

export const getExplorerTxHash = (_: Environment, chain: ChainId, txHash: string) => {
  let explorerTxHash = '';
  const platform = chainToPlatform(chainIdToChain(chain));
  if (platform === 'Cosmwasm') {
    explorerTxHash = txHash.slice(2);
  } else if (platform === 'Sui' || platform === 'Solana') {
    const txHashBytes = Buffer.from(txHash.slice(2), 'hex');
    explorerTxHash = base58.encode(txHashBytes);
  } else {
    explorerTxHash = txHash;
  }
  return explorerTxHash;
};
