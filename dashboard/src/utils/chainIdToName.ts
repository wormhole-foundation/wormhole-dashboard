import { CHAINS } from '@certusone/wormhole-sdk';

const chainIdToNameMap: { [chainId: string]: string } = {
  ...Object.fromEntries(Object.entries(CHAINS).map(([key, value]) => [value, key])),
  // not available in dependent sdk
  4000: 'cosmoshub',
  4001: 'evmos',
  4002: 'kujira',
  4003: 'neutron',
  4004: 'celestia',
  4005: 'stargaze',
  4006: 'seda',
  4007: 'dymension',
};
const chainIdToName = (chainId: number) => chainIdToNameMap[chainId] || 'Unknown';
export default chainIdToName;
