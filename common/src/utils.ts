import { ChainId, Network, encoding, toChainId } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { Mode } from './consts';

export async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
export const assertEnvironmentVariable = (varName: string) => {
  if (varName in process.env) return process.env[varName]!;
  throw new Error(`Missing required environment variable: ${varName}`);
};
export const MAX_UINT_16 = '65535';
export const padUint16 = (s: string): string => s.padStart(MAX_UINT_16.length, '0');
export const MAX_UINT_64 = '18446744073709551615';
export const padUint64 = (s: string): string => s.padStart(MAX_UINT_64.length, '0');

// make a bigtable row key for the `signedVAAs` table
export const makeSignedVAAsRowKey = (chain: number, emitter: string, sequence: string): string =>
  `${padUint16(chain.toString())}/${emitter}/${padUint64(sequence)}`;

export function getNetwork(): Network {
  const network: string = assertEnvironmentVariable('NETWORK').toLowerCase();
  if (network === 'mainnet') {
    return 'Mainnet';
  }
  if (network === 'testnet') {
    return 'Testnet';
  }
  if (network === 'devnet') {
    return 'Devnet';
  }
  throw new Error(`Unknown network: ${network}`);
}

export function getMode(): Mode {
  const mode: string = assertEnvironmentVariable('MODE').toLowerCase();
  if (mode === 'vaa' || mode === 'ntt') {
    return mode;
  }
  throw new Error(`Unknown mode: ${mode}`);
}

// This function basically strips off the `0x` prefix from the hex string.
export function universalAddress_stripped(u: UniversalAddress): string {
  return encoding.hex.encode(u.toUint8Array());
}

// This function takes a Chain or a ChainId as a string and returns
// the corresponding ChainId (or undefined if the chain is not recognized).
export function stringToChainId(input: string): ChainId | undefined {
  try {
    if (Number.isNaN(Number(input))) {
      return toChainId(input);
    }
    return toChainId(Number(input));
  } catch (e) {
    return undefined;
  }
}
