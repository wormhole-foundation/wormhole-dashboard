import { ChainId } from '@wormhole-foundation/sdk-base';

export type TokenAmount = {
  amount: string;
  decimals: number;
};

export function normalizeToDecimals(tokenAmount: TokenAmount, targetDecimals: number): bigint {
  const { amount, decimals } = tokenAmount;
  const bigIntAmount = BigInt(amount);
  let normalizedAmount: bigint;

  if (decimals < targetDecimals) {
    // If less decimals, multiply to shift the decimal point to the right
    const factor = BigInt(10 ** (targetDecimals - decimals));
    normalizedAmount = bigIntAmount * factor;
  } else if (decimals > targetDecimals) {
    // If more decimals, divide to shift the decimal point to the left
    const factor = BigInt(10 ** (decimals - targetDecimals));
    normalizedAmount = bigIntAmount / factor;
  } else {
    normalizedAmount = bigIntAmount;
  }

  return normalizedAmount;
}

export type NTTTotalSupplyAndLockedData = {
  tokenName: string;
  chain: ChainId;
  // this is bigint but for the sake of precision we are using string
  amountLocked?: TokenAmount;
  totalSupply?: TokenAmount;
  evmTotalSupply?: NTTTotalSupplyAndLockedData[];
};

export type NTTRateLimit = {
  tokenName: string;
  srcChain?: ChainId;
  destChain?: ChainId;
  amount?: TokenAmount;
  totalInboundCapacity?: TokenAmount;
  inboundCapacity?: NTTRateLimit[];
};
