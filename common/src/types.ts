import { ChainId } from '@wormhole-foundation/sdk-base';

export type NTTTotalSupplyAndLockedData = {
  tokenName: string;
  chain: ChainId;
  amountLocked?: Number;
  totalSupply: Number;
  evmTotalSupply?: NTTTotalSupplyAndLockedData[];
};

export type NTTRateLimit = {
  tokenName: string;
  srcChain?: ChainId;
  destChain?: ChainId;
  amount?: string;
  totalInboundCapacity?: string;
  inboundCapacity?: NTTRateLimit[];
};
