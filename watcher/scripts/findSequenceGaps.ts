import { chains, chainToChainId } from '@wormhole-foundation/connect-sdk';
import fs from 'fs';
import axios from 'axios';

// emitter => {sequence, timestamp}[]
type SequenceByEmitter = Record<string, [bigint, number][]>;
const URL = 'https://api.testnet.wormholescan.io/api/v1/vaas';

(async function () {
  // For each chain
  // page through VAAs until ts is > 4 weeks

  // get 4 weeks ago timestamp
  const until = new Date().getTime() - 4 * 7 * 24 * 60 * 60 * 1000;

  for (const cn of chains) {
    console.log('Working on: ', cn);
    const chain = chainToChainId.get(cn);
    for (let i = 0; i < 5; i++) {
      console.log(i);
      const rows: string[] = [];
      const sbe = await collectSeqences(chain!, until);
      for (const emitter in sbe) {
        const seqs = sbe[emitter];
        for (const seq of seqs) {
          rows.push(`${cn},${emitter},${seq[0]},${seqs[1]}`);
        }
      }
      fs.writeFileSync(`missing-seqs-${i}.csv`, rows.join('\n'));
    }

    //// Find gaps and produce stats
    //for (const emitter in sbe) {
    //  const seqs = sbe[emitter];

    //  for (let i = 0; i < seqs.length - 1; i++) {
    //    const sd = Number(seqs[i + 1][0] - seqs[i][0]);
    //    if (sd === 1) continue;

    //    const avgTs = seqs[i + 1][1] + (seqs[i + 1][1] - seqs[i][1]) / 2;
    //    rows.push(`${cn},${emitter},${avgTs},${seqs[i][0]},${sd}`);
    //  }
    //}
    //fs.writeFileSync('missing-seqs.csv', rows.join('\n'));
    return;
  }
})();

async function collectSeqences(chainId: number, until: number): Promise<SequenceByEmitter> {
  let sbe: SequenceByEmitter = {};
  let minTs = new Date().getTime();
  let page = 0;

  let seen: Record<string, boolean> = {};

  while (minTs > until) {
    const {
      data: { data: vaas },
    } = await axios.get(`${URL}/${chainId}?page=${page}&sort=DESC`);

    if (vaas.length === 0) break;

    for (const vaa of vaas) {
      // For some reason we get dupes?
      if (vaa.id in seen) continue;

      seen[vaa.id] = true;

      const emitter = vaa.emitterAddr;
      const vaaTime = Date.parse(vaa.timestamp);

      if (vaaTime < minTs) minTs = vaaTime;
      if (!(emitter in sbe)) sbe[emitter] = [];

      sbe[emitter].push([vaa.sequence, vaaTime]);
    }

    page += 1;
  }

  for (const emitter in sbe) {
    sbe[emitter] = sbe[emitter].sort((a: [bigint, number], b: [bigint, number]) =>
      Number(a[0] - b[0])
    );
  }

  return sbe;
}
