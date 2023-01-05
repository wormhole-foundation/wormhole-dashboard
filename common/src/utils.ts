export async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
export const MAX_UINT_16 = '65535';
export const padUint16 = (s: string): string => s.padStart(MAX_UINT_16.length, '0');
export const MAX_UINT_64 = '18446744073709551615';
export const padUint64 = (s: string): string => s.padStart(MAX_UINT_64.length, '0');
