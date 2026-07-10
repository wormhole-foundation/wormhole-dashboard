import { chainIdToChain, chainIds } from '@wormhole-foundation/sdk-base';
import { chainToIcon } from '@wormhole-foundation/sdk-icons';

export const WORMCHAIN_URL = 'https://wormchain-rpc.01.ro';

// Public Aptos fullnode REST endpoints, used to check whether the (event-driven)
// Aptos watcher is caught up with the latest on-chain Wormhole message.
export const APTOS_RPC_BY_NETWORK: { [env: string]: string } = {
  Mainnet: 'https://api.mainnet.aptoslabs.com',
  Testnet: 'https://api.testnet.aptoslabs.com',
};

export const WORMHOLE_RPC_HOSTS = [
  'https://wormhole-v2-mainnet-api.mcf.rocks',
  'https://wormhole-v2-mainnet-api.chainlayer.network',
  'https://wormhole-v2-mainnet-api.staking.fund',
];

export const CHAIN_ICON_MAP: { [key: string]: string } = chainIds.reduce<{ [key: string]: string }>(
  (icons, chainId) => {
    icons[chainId] = chainToIcon(chainIdToChain(chainId));
    return icons;
  },
  {}
);
