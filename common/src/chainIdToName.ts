import { toChain } from '@wormhole-foundation/sdk-base';

export const chainIdToName = (chainId: number) => {
  try {
    return toChain(chainId);
  } catch (e) {}
  return 'Unknown';
};
