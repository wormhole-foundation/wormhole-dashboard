import { parseAttestMetaVaa } from '@certusone/wormhole-sdk';
import {
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_FANTOM,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  ChainId,
} from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Bigtable } from '@google-cloud/bigtable';
import { padUint16 } from '@wormhole-foundation/wormhole-monitor-common';
import * as dotenv from 'dotenv';
import { BigtableSignedVAAsResultRow } from '../src/databases/types';
dotenv.config();

// Needed to go hunting for some attestations

(async () => {
  const bigtable = new Bigtable();
  const mainnetInstance = bigtable.instance(`wormhole-mainnet`);
  const vaaTable = mainnetInstance.table(`signedVAAs`);
  try {
    const chain: ChainId = CHAIN_ID_MOONBEAM;
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
        const meta = parseAttestMetaVaa(vaaBytes);
        const address = meta.tokenAddress.toString('hex').toLowerCase();
        const tokens = [
          '000000000000000000000000Acc15dC74880C9944775448304B263D191c6077F'.toLowerCase(),
        ];
        const isToken = tokens.find((t) => address.includes(t));
        if (meta.tokenChain === chain && isToken) {
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
