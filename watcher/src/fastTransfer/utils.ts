import { PUBLIC_KEY_LENGTH, PublicKey } from '@solana/web3.js';

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111'
);

export function programDataAddress(programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  )[0];
}

// solana/web3.js doesn't have a type-guard for PublicKey
// and we are trying to prevent using instanceof
// check only the essential methods
export function isPublicKey(thing: any): thing is PublicKey {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof thing.toBase58 === 'function' &&
    typeof thing.toBuffer === 'function' &&
    typeof thing.toBytes === 'function' &&
    thing.toBytes().length === PUBLIC_KEY_LENGTH
  );
}

function toCamelCase(s: string): string {
  return s.replace(/(_\w)/g, (m) => m[1].toUpperCase());
}

// Convert all keys in an object to camelCase
// Required in this repo to convert keys from snake_case to camelCase for type guarding
export function convertKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      result[toCamelCase(key)] = convertKeysToCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}
