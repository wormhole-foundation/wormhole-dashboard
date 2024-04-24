import { TokenAmount } from '@wormhole-foundation/wormhole-monitor-common';

export function normalizeBigNumber(
  tokenAmount: TokenAmount | undefined,
  decimalPlaces: number
): string {
  if (!tokenAmount) {
    return '0';
  }

  const bigIntValue = BigInt(tokenAmount.amount);
  const divisor = BigInt(10 ** tokenAmount.decimals);
  const integerPart = bigIntValue / divisor;
  const fractionalPart = bigIntValue % divisor;

  // Pad the fractional part with leading zeros if necessary
  const fractionalString = fractionalPart.toString().padStart(tokenAmount.decimals, '0');

  return `${integerPart.toLocaleString()}.${fractionalString.slice(0, decimalPlaces)}`;
}
