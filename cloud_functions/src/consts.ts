import { ChainId, toChainId } from '@wormhole-foundation/sdk-base';

// TODO: this should probably be a table in the database
export const TVL_TOKEN_DENYLIST: { [key in ChainId]?: string[] } = {
  [toChainId('Fantom')]: ['0x5b2af7fd27e2ea14945c82dd254c79d3ed34685e'], // coingecko reporting bad prices
};

export const isTokenDenylisted = (chainId: ChainId, address: string): boolean => {
  return TVL_TOKEN_DENYLIST[chainId]?.includes(address.toLowerCase()) ?? false;
};
