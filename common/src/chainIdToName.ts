import { toChain } from '@wormhole-foundation/sdk-base';

const chainIdToName = (chainId: number) => {
  try {
    return toChain(chainId);
  } catch (e) {}
  return 'Unknown';
};
export default chainIdToName;
