import { ChainId, chainIdToChain, chainToPlatform, toChainId } from '@wormhole-foundation/sdk-base';
import { base58 } from 'ethers/lib/utils';
import { Environment } from './consts';

export const explorerBlock = (network: Environment, chainId: ChainId, block: string) =>
  network === 'mainnet'
    ? chainId === toChainId('Solana')
      ? `https://solana.fm/block/${block}`
      : chainId === toChainId('Ethereum')
      ? `https://etherscan.io/block/${block}`
      : chainId === toChainId('Terra')
      ? `https://finder.terra.money/columbus-5/block/${block}`
      : chainId === toChainId('Bsc')
      ? `https://bscscan.com/block/${block}`
      : chainId === toChainId('Polygon')
      ? `https://polygonscan.com/block/${block}`
      : chainId === toChainId('Avalanche')
      ? `https://snowtrace.io/block/${block}`
      : chainId === toChainId('Oasis')
      ? `https://explorer.emerald.oasis.dev/block/${block}`
      : chainId === toChainId('Algorand')
      ? `https://app.dappflow.org/explorer/block/${block}`
      : chainId === toChainId('Fantom')
      ? `https://ftmscan.com/block/${block}`
      : chainId === toChainId('Karura')
      ? `https://blockscout.karura.network/block/${block}`
      : chainId === toChainId('Acala')
      ? `https://blockscout.acala.network/block/${block}`
      : chainId === toChainId('Klaytn')
      ? `https://scope.klaytn.com/block/${block}`
      : chainId === toChainId('Celo')
      ? `https://explorer.celo.org/block/${block}`
      : chainId === toChainId('Near')
      ? `https://nearblocks.io/blocks/${block}`
      : chainId === toChainId('Moonbeam')
      ? `https://moonscan.io/block/${block}`
      : chainId === toChainId('Terra2')
      ? `https://finder.terra.money/phoenix-1/block/${block}`
      : chainId === toChainId('Injective')
      ? `https://explorer.injective.network/block/${block}`
      : chainId === toChainId('Sui')
      ? `https://suiexplorer.com/checkpoint/${block}`
      : chainId === toChainId('Aptos')
      ? `https://explorer.aptoslabs.com/block/${block}`
      : chainId === toChainId('Arbitrum')
      ? `https://arbiscan.io/block/${block}`
      : chainId === toChainId('Optimism')
      ? `https://optimistic.etherscan.io/block/${block}`
      : chainId === toChainId('Xpla')
      ? `https://explorer.xpla.io/mainnet/block/${block}`
      : chainId === toChainId('Base')
      ? `https://basescan.org/block/${block}`
      : chainId === toChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/blocks/${block}`
      : chainId === toChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/blocks/${block}`
      : ''
    : chainId === toChainId('Solana')
    ? `https://explorer.solana.com/${block}?cluster=testnet`
    : chainId === toChainId('Ethereum')
    ? `https://sepolia.etherscan.io/block/${block}`
    : // : chainId === toChainId('Terra') <-- not supported on testnet dashboard
    chainId === toChainId('Bsc')
    ? `https://testnet.bscscan.com/block/${block}`
    : chainId === toChainId('Polygon')
    ? `https://mumbai.polygonscan.com/block/${block}`
    : chainId === toChainId('Avalanche')
    ? `https://testnet.snowtrace.io/block/${block}`
    : chainId === toChainId('Oasis')
    ? `https://testnet.oasisscan.com/block/${block}`
    : chainId === toChainId('Algorand')
    ? `https://app.dappflow.org/explorer/block/${block}`
    : chainId === toChainId('Fantom')
    ? `https://testnet.ftmscan.com/block/${block}`
    : // : chainId === toChainId('Karura') <-- not supported on testnet dashboard
    chainId === toChainId('Acala')
    ? `https://blockscout.mandala.aca-staging.network/block/${block}`
    : chainId === toChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/block/${block}`
    : chainId === toChainId('Celo')
    ? `https://alfajores.celoscan.io/block/${block}`
    : // : chainId === toChainId('Near') <-- not supported on testnet dashboard
    chainId === toChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/block/${block}`
    : // : chainId === toChainId('Terra2') <-- not supported on testnet dashboard
    // : chainId === toChainId('Injective') <-- not supported on testnet dashboard
    chainId === toChainId('Sui')
    ? `https://suiexplorer.com/checkpoint/${block}?network=testnet`
    : chainId === toChainId('Aptos')
    ? `https://explorer.aptoslabs.com/block/${block}?network=testnet`
    : chainId === toChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/block/${block}`
    : chainId === toChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/block/${block}`
    : chainId === toChainId('Xpla')
    ? `https://explorer.xpla.io/testnet/block/${block}`
    : chainId === toChainId('Base')
    ? `https://goerli.basescan.org/block/${block}`
    : chainId === toChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/blocks/${block}`
    : // : chainId === toChainId('Wormscan') <-- not supported on testnet dashboard
      '';

export const explorerTx = (network: Environment, chainId: ChainId, tx: string) =>
  network === 'mainnet'
    ? chainId === toChainId('Solana')
      ? `https://solana.fm/tx/${tx}`
      : chainId === toChainId('Ethereum')
      ? `https://etherscan.io/tx/${tx}`
      : chainId === toChainId('Terra')
      ? `https://finder.terra.money/columbus-5/tx/${tx}`
      : chainId === toChainId('Bsc')
      ? `https://bscscan.com/tx/${tx}`
      : chainId === toChainId('Polygon')
      ? `https://polygonscan.com/tx/${tx}`
      : chainId === toChainId('Avalanche')
      ? `https://snowtrace.io/tx/${tx}`
      : chainId === toChainId('Oasis')
      ? `https://explorer.emerald.oasis.dev/tx/${tx}`
      : chainId === toChainId('Algorand')
      ? `https://app.dappflow.org/explorer/transaction/${tx}`
      : chainId === toChainId('Fantom')
      ? `https://ftmscan.com/tx/${tx}`
      : chainId === toChainId('Karura')
      ? `https://blockscout.karura.network/tx/${tx}`
      : chainId === toChainId('Acala')
      ? `https://blockscout.acala.network/tx/${tx}`
      : chainId === toChainId('Klaytn')
      ? `https://scope.klaytn.com/tx/${tx}`
      : chainId === toChainId('Celo')
      ? `https://explorer.celo.org/tx/${tx}`
      : chainId === toChainId('Near')
      ? `https://explorer.near.org/transactions/${tx}`
      : chainId === toChainId('Moonbeam')
      ? `https://moonscan.io/tx/${tx}`
      : chainId === toChainId('Terra2')
      ? `https://finder.terra.money/phoenix-1/tx/${tx}`
      : chainId === toChainId('Injective')
      ? `https://explorer.injective.network/transaction/${tx}`
      : chainId === toChainId('Sui')
      ? `https://suiexplorer.com/txblock/${tx}`
      : chainId === toChainId('Aptos')
      ? `https://explorer.aptoslabs.com/txn/${tx}?network=mainnet`
      : chainId === toChainId('Arbitrum')
      ? `https://arbiscan.io/tx/${tx}`
      : chainId === toChainId('Optimism')
      ? `https://optimistic.etherscan.io/tx/${tx}`
      : chainId === toChainId('Xpla')
      ? `https://explorer.xpla.io/mainnet/tx/${tx}`
      : chainId === toChainId('Base')
      ? `https://basescan.org/tx/${tx}`
      : chainId === toChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/txs/${tx}`
      : chainId === toChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/transactions/${tx}`
      : ''
    : chainId === toChainId('Solana')
    ? `https://solscan.io/txs/${tx}?cluster=testnet`
    : chainId === toChainId('Ethereum')
    ? `https://sepolia.etherscan.io/tx/${tx}`
    : // : chainId === toChainId('Terra') <-- not supported on testnet dashboard
    chainId === toChainId('Bsc')
    ? `https://testnet.bscscan.com/tx/${tx}`
    : chainId === toChainId('Polygon')
    ? `https://mumbai.polygonscan.com/tx/${tx}`
    : chainId === toChainId('Avalanche')
    ? `https://testnet.snowtrace.io/tx/${tx}`
    : chainId === toChainId('Oasis')
    ? `https://testnet.oasisscan.com/tx/${tx}`
    : chainId === toChainId('Algorand')
    ? `https://app.dappflow.org/explorer/transaction/${tx}`
    : chainId === toChainId('Fantom')
    ? `https://testnet.ftmscan.com/tx/${tx}`
    : // chainId === toChainId('Karura') <-- not supported on testnet dashboard
    chainId === toChainId('Acala')
    ? `https://blockscout.mandala.aca-staging.network/tx/${tx}`
    : chainId === toChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/tx/${tx}`
    : chainId === toChainId('Celo')
    ? `https://alfajores.celoscan.io/tx/${tx}`
    : //  chainId === toChainId('Near') <-- not supported on testnet dashboard
    chainId === toChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/tx/${tx}`
    : // chainId === toChainId('Terra2') <-- not supported on testnet dashboard
    // chainId === toChainId('Injective') <-- not supported on testnet dashboard
    chainId === toChainId('Sui')
    ? `https://suiexplorer.com/txblock/${tx}?network=testnet`
    : chainId === toChainId('Aptos')
    ? `https://explorer.aptoslabs.com/txn/${tx}?network=testnet`
    : chainId === toChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/tx/${tx}`
    : chainId === toChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/tx/${tx}`
    : chainId === toChainId('Xpla')
    ? `https://explorer.xpla.io/testnet/tx/${tx}`
    : chainId === toChainId('Base')
    ? `https://goerli.basescan.org/tx/${tx}`
    : chainId === toChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/txs/${tx}`
    : // chainId === toChainId('Wormscan') <-- not supported on testnet dashboard
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
