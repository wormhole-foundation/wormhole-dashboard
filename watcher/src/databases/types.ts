import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
export type VaasByBlock = { [blockInfo: string]: string[] };
export type DB = { [chain in ChainId]?: VaasByBlock };
export type LastBlockByChain = { [chain in ChainId]?: string };
