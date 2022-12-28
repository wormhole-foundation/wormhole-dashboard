import { ChainId } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Row } from '@google-cloud/bigtable';
export type VaasByBlock = { [blockInfo: string]: string[] };
export type DB = { [chain in ChainId]?: VaasByBlock };
export type LastBlockByChain = { [chain in ChainId]?: string };
export type BigtableMessagesRow = {
  key: string;
  data: {
    // column family
    info: {
      // columns
      timestamp?: { value: string; timestamp: string };
      txHash?: { value: string; timestamp: string };
      hasSignedVaa?: { value: number; timestamp: string };
    };
  };
};
export interface BigtableMessagesResultRow extends Row {
  key: string;
  data: {
    // column family
    info: {
      // columns
      timestamp?: [{ value: string; timestamp: string }];
      txHash?: [{ value: string; timestamp: string }];
      hasSignedVaa?: [{ value: number; timestamp: string }];
    };
  };
}
export interface BigtableVAAsResultRow extends Row {
  key: string;
  data: {
    // column family
    QuorumState: {
      // columns
      SignedVAA?: [{ value: Buffer; timestamp: string }];
    };
  };
}
