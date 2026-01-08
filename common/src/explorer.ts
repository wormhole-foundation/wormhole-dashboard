import {
  ChainId,
  Network,
  chainIdToChain,
  chainToChainId,
  chainToPlatform,
} from '@wormhole-foundation/sdk-base';
import base58 from 'bs58';
import { Buffer } from 'buffer';

export const explorerBlock = (network: Network, chainId: ChainId, block: string) =>
  network === 'Mainnet'
    ? chainId === chainToChainId('Solana')
      ? `https://solana.fm/block/${block}`
      : chainId === chainToChainId('Ethereum')
      ? `https://etherscan.io/block/${block}`
      : chainId === chainToChainId('Bsc')
      ? `https://bscscan.com/block/${block}`
      : chainId === chainToChainId('Polygon')
      ? `https://polygonscan.com/block/${block}`
      : chainId === chainToChainId('Avalanche')
      ? `https://snowtrace.io/block/${block}`
      : chainId === chainToChainId('Algorand')
      ? `https://app.dappflow.org/explorer/block/${block}`
      : chainId === chainToChainId('Klaytn')
      ? `https://scope.klaytn.com/block/${block}`
      : chainId === chainToChainId('Celo')
      ? `https://explorer.celo.org/block/${block}`
      : chainId === chainToChainId('Near')
      ? `https://nearblocks.io/blocks/${block}`
      : chainId === chainToChainId('Moonbeam')
      ? `https://moonscan.io/block/${block}`
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
      : chainId === chainToChainId('Base')
      ? `https://basescan.org/block/${block}`
      : chainId === chainToChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/blocks/${block}`
      : chainId === chainToChainId('Scroll')
      ? `https://scrollscan.com/block/${block}`
      : chainId === chainToChainId('Mantle')
      ? `https://explorer.mantle.xyz/block/${block}`
      : chainId === chainToChainId('Xlayer')
      ? `https://www.oklink.com/xlayer/block/${block}`
      : chainId === chainToChainId('Linea')
      ? `https://lineascan.build/block/${block}`
      : chainId === chainToChainId('Berachain')
      ? `https://berascan.com/block/${block}`
      : chainId === chainToChainId('Unichain')
      ? `https://unichain.blockscout.com/block/${block}`
      : chainId === chainToChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/blocks/${block}`
      : chainId === chainToChainId('Worldchain')
      ? `https://worldscan.org/block/${block}`
      : chainId === chainToChainId('Ink')
      ? `https://explorer.inkonchain.com/block/${block}`
      : chainId === chainToChainId('HyperEVM')
      ? `https://www.hyperscan.com/block/${block}`
      : chainId === chainToChainId('Mezo')
      ? `https://explorer.mezo.org/block/${block}`
      : chainId === chainToChainId('Plume')
      ? `https://explorer.plume.org/block/${block}`
      : chainId === chainToChainId('XRPLEVM')
      ? `https://explorer.xrplevm.org/block/${block}`
      : chainId === chainToChainId('Fogo')
      ? `https://explorer.fogo.io/block/${block}?cluster=mainnet`
      : chainId === chainToChainId('Monad')
      ? `https://monadvision.com/block/${block}`
      : chainId === chainToChainId('Moca')
      ? `https://moca-mainnet.cloud.blockscout.com/block/${block}`
      : chainId === chainToChainId('MegaETH')
      ? `https://megaeth.blockscout.com/block/${block}`
      : ''
    : chainId === chainToChainId('Solana')
    ? `https://explorer.solana.com/${block}?cluster=testnet`
    : chainId === chainToChainId('Ethereum')
    ? `https://sepolia.etherscan.io/block/${block}`
    : chainId === chainToChainId('Bsc')
    ? `https://testnet.bscscan.com/block/${block}`
    : chainId === chainToChainId('Polygon')
    ? `https://mumbai.polygonscan.com/block/${block}`
    : chainId === chainToChainId('Avalanche')
    ? `https://testnet.snowtrace.io/block/${block}`
    : chainId === chainToChainId('Algorand')
    ? `https://app.dappflow.org/explorer/block/${block}`
    : chainId === chainToChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/block/${block}`
    : chainId === chainToChainId('Celo')
    ? `https://alfajores.celoscan.io/block/${block}`
    : // : chainId === chainToChainId('Near') <-- not supported on testnet dashboard
    chainId === chainToChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/block/${block}`
    : // : chainId === chainToChainId('Injective') <-- not supported on testnet dashboard
    chainId === chainToChainId('Sui')
    ? `https://suiexplorer.com/checkpoint/${block}?network=testnet`
    : chainId === chainToChainId('Aptos')
    ? `https://explorer.aptoslabs.com/block/${block}?network=testnet`
    : chainId === chainToChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/block/${block}`
    : chainId === chainToChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/block/${block}`
    : chainId === chainToChainId('Base')
    ? `https://goerli.basescan.org/block/${block}`
    : chainId === chainToChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/blocks/${block}`
    : chainId === chainToChainId('Scroll')
    ? `https://sepolia.scrollscan.com/block/${block}`
    : chainId === chainToChainId('Mantle')
    ? `https://explorer.sepolia.mantle.xyz/block/${block}`
    : chainId === chainToChainId('Xlayer')
    ? `https://www.oklink.com/xlayer-test/block/${block}`
    : chainId === chainToChainId('Linea')
    ? `https://sepolia.lineascan.build/block/${block}`
    : chainId === chainToChainId('Berachain')
    ? `https://bepolia.beratrail.io/block/${block}`
    : chainId === chainToChainId('Seievm')
    ? `https://seitrace.com/block/${block}?chain=atlantic-2`
    : chainId === chainToChainId('Unichain')
    ? `https://unichain-sepolia.blockscout.com/block/${block}`
    : chainId === chainToChainId('Worldchain')
    ? `https://worldchain-sepolia.explorer.alchemy.com/block/${block}`
    : chainId === chainToChainId('MonadTestnet')
    ? `https://testnet.monadvision.com/block/${block}`
    : chainId === chainToChainId('Ink')
    ? `https://explorer-sepolia.inkonchain.com/block/${block}`
    : chainId === chainToChainId('HyperEVM')
    ? `https://testnet.purrsec.com/block/${block}`
    : chainId === chainToChainId('Mezo')
    ? `https://explorer.test.mezo.org/block/${block}`
    : chainId === chainToChainId('Converge')
    ? `https://explorer-converge-testnet-1.t.conduit.xyz/block/${block}`
    : chainId === chainToChainId('Plume')
    ? `https://testnet-explorer.plume.org/block/${block}`
    : chainId === chainToChainId('XRPLEVM')
    ? `https://explorer.testnet.xrplevm.org/block/${block}`
    : chainId === chainToChainId('Fogo')
    ? `https://explorer.fogo.io/block/${block}?cluster=testnet`
    : chainId === chainToChainId('Moca')
    ? `https://testnet-scan.mocachain.org/block/${block}`
    : chainId === chainToChainId('MegaETH')
    ? `https://megaeth-testnet-v2.blockscout.com/block/${block}`
    : // : chainId === chainToChainId('Wormscan') <-- not supported on testnet dashboard
      '';

export const explorerTx = (network: Network, chainId: ChainId, tx: string) =>
  network === 'Mainnet'
    ? chainId === chainToChainId('Solana')
      ? `https://solana.fm/tx/${tx}`
      : chainId === chainToChainId('Ethereum')
      ? `https://etherscan.io/tx/${tx}`
      : chainId === chainToChainId('Bsc')
      ? `https://bscscan.com/tx/${tx}`
      : chainId === chainToChainId('Polygon')
      ? `https://polygonscan.com/tx/${tx}`
      : chainId === chainToChainId('Avalanche')
      ? `https://snowtrace.io/tx/${tx}`
      : chainId === chainToChainId('Algorand')
      ? `https://app.dappflow.org/explorer/transaction/${tx}`
      : chainId === chainToChainId('Klaytn')
      ? `https://scope.klaytn.com/tx/${tx}`
      : chainId === chainToChainId('Celo')
      ? `https://explorer.celo.org/tx/${tx}`
      : chainId === chainToChainId('Near')
      ? `https://explorer.near.org/transactions/${tx}`
      : chainId === chainToChainId('Moonbeam')
      ? `https://moonscan.io/tx/${tx}`
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
      : chainId === chainToChainId('Base')
      ? `https://basescan.org/tx/${tx}`
      : chainId === chainToChainId('Sei')
      ? `https://www.seiscan.app/pacific-1/txs/${tx}`
      : chainId === chainToChainId('Scroll')
      ? `https://scrollscan.com/tx/${tx}`
      : chainId === chainToChainId('Mantle')
      ? `https://explorer.mantle.xyz/tx/${tx}`
      : chainId === chainToChainId('Xlayer')
      ? `https://www.oklink.com/xlayer/tx/${tx}`
      : chainId === chainToChainId('Linea')
      ? `https://lineascan.build/tx/${tx}`
      : chainId === chainToChainId('Berachain')
      ? `https://berascan.com/tx/${tx}`
      : chainId === chainToChainId('Unichain')
      ? `https://unichain.blockscout.com/tx/${tx}`
      : chainId === chainToChainId('Wormchain')
      ? `https://bigdipper.live/wormhole/transactions/${tx}`
      : chainId === chainToChainId('Worldchain')
      ? `https://worldscan.org/tx/${tx}`
      : chainId === chainToChainId('Ink')
      ? `https://explorer.inkonchain.com/tx/${tx}`
      : chainId === chainToChainId('HyperEVM')
      ? `https://www.hyperscan.com/tx/${tx}`
      : chainId === chainToChainId('Mezo')
      ? `https://explorer.mezo.org/tx/${tx}`
      : chainId === chainToChainId('Plume')
      ? `https://explorer.plume.org/tx/${tx}`
      : chainId === chainToChainId('XRPLEVM')
      ? `https://explorer.xrplevm.org/tx/${tx}`
      : chainId === chainToChainId('Fogo')
      ? `https://explorer.fogo.io/tx/${tx}?cluster=mainnet`
      : chainId === chainToChainId('Monad')
      ? `https://monadvision.com/tx/${tx}`
      : chainId === chainToChainId('Moca')
      ? `https://moca-mainnet.cloud.blockscout.com/tx/${tx}`
      : chainId === chainToChainId('MegaETH')
      ? `https://megaeth.blockscout.com/tx/${tx}`
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
    : chainId === chainToChainId('Algorand')
    ? `https://app.dappflow.org/explorer/transaction/${tx}`
    : chainId === chainToChainId('Klaytn')
    ? `https://baobab.klaytnscope.com/tx/${tx}`
    : chainId === chainToChainId('Celo')
    ? `https://alfajores.celoscan.io/tx/${tx}`
    : //  chainId === chainToChainId('Near') <-- not supported on testnet dashboard
    chainId === chainToChainId('Moonbeam')
    ? `https://moonbase.moonscan.io/tx/${tx}`
    : // chainId === chainToChainId('Injective') <-- not supported on testnet dashboard
    chainId === chainToChainId('Sui')
    ? `https://suiexplorer.com/txblock/${tx}?network=testnet`
    : chainId === chainToChainId('Aptos')
    ? `https://explorer.aptoslabs.com/txn/${tx}?network=testnet`
    : chainId === chainToChainId('Arbitrum')
    ? `https://sepolia.arbiscan.io/tx/${tx}`
    : chainId === chainToChainId('Optimism')
    ? `https://sepolia-optimism.etherscan.io/tx/${tx}`
    : chainId === chainToChainId('Base')
    ? `https://goerli.basescan.org/tx/${tx}`
    : chainId === chainToChainId('Sei')
    ? `https://www.seiscan.app/atlantic-2/txs/${tx}`
    : chainId === chainToChainId('Scroll')
    ? `https://sepolia.scrollscan.com/tx/${tx}`
    : chainId === chainToChainId('Mantle')
    ? `https://explorer.sepolia.mantle.xyz/tx/${tx}`
    : chainId === chainToChainId('Xlayer')
    ? `https://www.oklink.com/xlayer-test/tx/${tx}`
    : chainId === chainToChainId('Linea')
    ? `https://sepolia.lineascan.build/tx/${tx}`
    : chainId === chainToChainId('Berachain')
    ? `https://bepolia.beratrail.io/tx/${tx}`
    : chainId === chainToChainId('Seievm')
    ? `https://seitrace.com/tx/${tx}?chain=atlantic-2`
    : chainId === chainToChainId('Unichain')
    ? `https://unichain-sepolia.blockscout.com/tx/${tx}`
    : chainId === chainToChainId('Worldchain')
    ? `https://worldchain-sepolia.explorer.alchemy.com/tx/${tx}`
    : chainId === chainToChainId('MonadTestnet')
    ? `https://testnet.monadvision.com/tx/${tx}`
    : chainId === chainToChainId('Ink')
    ? `https://explorer-sepolia.inkonchain.com/tx/${tx}`
    : chainId === chainToChainId('HyperEVM')
    ? `https://testnet.purrsec.com/tx/${tx}`
    : chainId === chainToChainId('Mezo')
    ? `https://explorer.test.mezo.org/tx/${tx}`
    : chainId === chainToChainId('Converge')
    ? `https://explorer-converge-testnet-1.t.conduit.xyz/tx/${tx}`
    : chainId === chainToChainId('Plume')
    ? `https://testnet-explorer.plume.org/tx/${tx}`
    : chainId === chainToChainId('XRPLEVM')
    ? `https://explorer.testnet.xrplevm.org/tx/${tx}`
    : chainId === chainToChainId('Fogo')
    ? `https://explorer.fogo.io/tx/${tx}?cluster=testnet`
    : chainId === chainToChainId('Moca')
    ? `https://testnet-scan.mocachain.org/tx/${tx}`
    : chainId === chainToChainId('MegaETH')
    ? `https://megaeth-testnet-v2.blockscout.com/tx/${tx}`
    : // chainId === chainToChainId('Wormscan') <-- not supported on testnet dashboard
      '';

export const explorerVaa = (network: Network, key: string) =>
  network === 'Mainnet'
    ? `https://wormholescan.io/#/tx/${key}`
    : `https://wormholescan.io/#/tx/${key}?network=TESTNET`;

export const getExplorerTxHash = (_: Network, chain: ChainId, txHash: string) => {
  let explorerTxHash = '';
  const platform = chainToPlatform(chainIdToChain(chain));
  if (platform === 'Cosmwasm') {
    explorerTxHash = txHash.slice(2);
  } else if (platform === 'Sui' || platform === 'Solana' || platform === 'Near') {
    const txHashBytes = Buffer.from(txHash.slice(2), 'hex');
    explorerTxHash = base58.encode(txHashBytes);
  } else {
    explorerTxHash = txHash;
  }
  return explorerTxHash;
};
