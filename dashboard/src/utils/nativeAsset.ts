import { chainToChainId, chainToPlatform, toChain } from '@wormhole-foundation/sdk-base';
import base58 from 'bs58';
import { Buffer } from 'buffer';

// ported from @certusone/wormhole-sdk

const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith('0x')) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, 'hex'));
};

function hexToNativeAssetStringAlgorand(s: string): string {
  return BigInt(s.startsWith('0x') ? s : `0x${s}`).toString();
}

const tryUint8ArrayToNative = (a: Uint8Array, chain: number): string => {
  const platform = chainToPlatform(toChain(chain));
  if (platform === 'Evm') {
    return `0x${Buffer.from(a).toString('hex').substring(24)}`;
  } else if (platform === 'Solana') {
    return base58.encode(a);
  }
  return `0x${Buffer.from(a).toString('hex')}`;
};

const tryHexToNativeString = (h: string, c: number): string =>
  tryUint8ArrayToNative(hexToUint8Array(h), c);

export const tryHexToNativeAssetString = (h: string, c: number): string =>
  c === chainToChainId('Algorand')
    ? // Algorand assets are represented by their asset ids, not an address
      hexToNativeAssetStringAlgorand(h)
    : tryHexToNativeString(h, c);
