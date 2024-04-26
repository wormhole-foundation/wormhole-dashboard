import { Bigtable } from '@google-cloud/bigtable';
import { padUint16, universalAddress_stripped } from '@wormhole-foundation/wormhole-monitor-common';
import * as dotenv from 'dotenv';
import { BigtableSignedVAAsResultRow } from '../src/databases/types';
import { ChainId, chainToChainId } from '@wormhole-foundation/sdk-base';
import { VAA, deserialize } from '@wormhole-foundation/sdk-definitions';
dotenv.config();

// Needed to go hunting for some attestations

(async () => {
  const bigtable = new Bigtable();
  const mainnetInstance = bigtable.instance(`wormhole-mainnet`);
  const vaaTable = mainnetInstance.table(`signedVAAs`);
  try {
    const chain: ChainId = chainToChainId('Moonbeam');
    const prefix = `${padUint16(
      chain.toString()
    )}/${'000000000000000000000000B1731c586ca89a23809861c6103F0b96B3F57D92'.toLowerCase()}/`;
    const vaaRows = (
      await vaaTable.getRows({ prefix, decode: false })
    )[0] as BigtableSignedVAAsResultRow[];
    console.log(vaaRows.length);
    for (const row of vaaRows) {
      try {
        const vaaBytes = row.data.info.bytes[0].value;
        // const meta = parseAttestMetaVaa(vaaBytes);
        const meta: VAA<'TokenBridge:AttestMeta'> = deserialize('TokenBridge:AttestMeta', vaaBytes);
        const address = universalAddress_stripped(meta.payload.token.address).toLowerCase();
        // const address = meta.tokenAddress.toString('hex').toLowerCase();
        const tokens = [
          '000000000000000000000000Acc15dC74880C9944775448304B263D191c6077F'.toLowerCase(),
        ];
        const isToken = tokens.find((t) => address.includes(t));
        // if (meta.tokenChain === chain && isToken) {
        if (chainToChainId(meta.payload.token.chain) === chain && isToken) {
          console.log(isToken, vaaBytes.toString('hex'));
        }
      } catch (e) {
        // console.log('err');
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
