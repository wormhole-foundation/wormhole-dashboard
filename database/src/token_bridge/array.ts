import { Provider as NearProvider } from 'near-api-js/lib/providers';
import { hashLookup } from './near';

import {
  Chain,
  ChainId,
  UniversalAddress,
  chainToChainId,
  toChain,
} from '@wormhole-foundation/sdk';

export const tryHexToNativeStringNear = async (
  provider: NearProvider,
  tokenBridge: string,
  address: string
): Promise<string> => {
  const { found, value } = await hashLookup(provider, tokenBridge, address);
  if (!found) {
    throw new Error('Address not found');
  }
  return value;
};

/**
 *
 * Convert an address in a wormhole's 32-byte hex representation into a chain's native
 * string representation.
 *
 * @throws if address is not the right length for the given chain
 */
export const tryHexToNativeAssetString = (h: string, c: ChainId): string =>
  c === chainToChainId('Algorand')
    ? // Algorand assets are represented by their asset ids, not an address
      new UniversalAddress(h).toNative('Algorand').toBigInt().toString()
    : new UniversalAddress(h).toNative(toChain(c)).toString();
