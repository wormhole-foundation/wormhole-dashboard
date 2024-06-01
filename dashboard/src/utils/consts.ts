import { chainIdToChain, chainIds } from '@wormhole-foundation/sdk-base';
import { chainToIcon } from '@wormhole-foundation/sdk-icons';

export const WORMCHAIN_URL = 'https://tncnt-eu-wormchain-main-01.rpc.p2p.world';
export const TESTNET_WORMCHAIN_URL = `https://corsproxy.io/?${encodeURIComponent(
  'https://gateway.testnet.xlabs.xyz'
)}`;

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
