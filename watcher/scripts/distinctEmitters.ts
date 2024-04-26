import * as dotenv from 'dotenv';
dotenv.config();
import { Bigtable } from '@google-cloud/bigtable';
import { BigtableSignedVAAsResultRow } from '../src/databases/types';
import { ChainId, chainIdToChain } from '@wormhole-foundation/sdk-base';

// This script fetches the number of distinct emitters per chain

(async () => {
  const bigtable = new Bigtable();
  const instance = bigtable.instance(`wormhole-mainnet`);
  const vaaTable = instance.table(`signedVAAs`);
  try {
    const emittersByChain = new Map<ChainId, string[]>();
    // Fetch the row keys with sequence number 0
    // This is a hack to fetch the distinct emitters from bigtable *efficiently*
    // WARNING: This won't work once there are > 10000 distinct emitters
    const filter = { row: /.*\/.*\/00000000000000000000/ };
    const vaaRows = (
      await vaaTable.getRows({ filter, decode: false, limit: 10000 })
    )[0] as BigtableSignedVAAsResultRow[];
    for (const row of vaaRows) {
      const key = (row.id as unknown as Buffer).toString();
      const [chain, emitter] = key.split('/');
      const chainId = parseInt(chain) as ChainId; // yuck...
      const emitters = emittersByChain.get(chainId);
      emittersByChain.set(chainId, [...(emitters || []), emitter]);
    }
    for (const [chainId, emitters] of emittersByChain) {
      console.log(chainIdToChain(chainId), emitters.length);
    }
  } catch (e) {
    console.error(e);
  }
})();
