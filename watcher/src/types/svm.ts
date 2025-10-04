import { Chain } from '@wormhole-foundation/sdk-base';

export type SVMChain = Extract<Chain, 'Solana' | 'Fogo'>;
