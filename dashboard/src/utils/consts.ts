import { chainIdToChain, chainIds } from '@wormhole-foundation/sdk-base';
import { chainToIcon } from '@wormhole-foundation/sdk-icons';

export const WORMCHAIN_URL = import.meta.env.DEV
  ? '/wormchain'
  : 'https://gateway.mainnet.xlabs.xyz';
export const TESTNET_WORMCHAIN_URL = import.meta.env.DEV
  ? '/wormchain-testnet'
  : 'https://gateway.testnet.xlabs.xyz';

export const WORMHOLE_RPC_HOSTS = [
  'https://wormhole-v2-mainnet-api.mcf.rocks',
  'https://wormhole-v2-mainnet-api.chainlayer.network',
  'https://wormhole-v2-mainnet-api.staking.fund',
  'https://guardian.mainnet.xlabs.xyz',
];

export const CHAIN_ICON_MAP: { [key: string]: string } = chainIds.reduce<{ [key: string]: string }>(
  (icons, chainId) => {
    icons[chainId] = chainToIcon(chainIdToChain(chainId));
    return icons;
  },
  {}
);
