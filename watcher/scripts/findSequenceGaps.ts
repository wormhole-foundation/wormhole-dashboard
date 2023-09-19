import { chains, chainToChainId } from '@wormhole-foundation/connect-sdk';
import fs from 'fs';
import axios from 'axios';

// emitter => {sequence, timestamp}[]
type Seen = [bigint, number];
type SequenceByEmitter = Record<string, Seen[]>;
const URLS: string[] = [
  'https://api.testnet.wormscan.io/api/v1/vaas',
  // 'https://api.testnet.wormholescan.io/api/v1/vaas',
];

(async function () {
  const weeks = 8;
  const until = new Date().getTime() - weeks * 7 * 24 * 60 * 60 * 1000;
  const missing: string[] = [`chain_id/emitter/sequence,start_time,stop_time`];
  // iterate through chains pulling n weeks of sequences, write to csv
  for (const cn of chains) {
    console.log('Working on: ', cn);
    const chain = chainToChainId.get(cn);
    if (!chain) continue;

    const sbe = await collectSeqences(chain!, until);
    for (const emitter in sbe) {
      const seqs = sbe[emitter];

      for (let i = 0; i < seqs.length - 1; i++) {
        const [newSeq, newTime] = seqs[i + 1]; // deeper is newer
        const [oldSeq, oldTime] = seqs[i];
        const delta = Number(newSeq - oldSeq);

        if (delta === 1) continue;

        for (let j = 1; j < delta; j++) {
          const missingSeq = Number(oldSeq) + j;
          missing.push(`${chain}/${emitter}/${missingSeq},${oldTime},${newTime}`);
        }
      }
    }
  }

  fs.writeFileSync(`missing-seqs.csv`, missing.join('\n'));
})();

async function collectSeqences(chainId: number, until: number): Promise<SequenceByEmitter> {
  let sbe: SequenceByEmitter = {};
  let seen: Record<string, boolean> = {};

  for (const url of URLS) {
    let page = 0;
    let minTs = new Date().getTime();
    while (minTs > until) {
      const {
        data: { data: vaas },
      } = await axios.get(`${url}/${chainId}?page=${page}&pageSize=100`, {
        // requied because the cache is busted as of writing
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });

      if (vaas.length === 0) break;

      for (const vaa of vaas) {
        if (vaa.id in seen) continue;

        seen[vaa.id] = true;

        const seq = BigInt(vaa.sequence);
        const emitter = vaa.emitterAddr;
        const vaaTime = Date.parse(vaa.timestamp);

        if (vaaTime < minTs) minTs = vaaTime;
        if (minTs < until) break;

        if (!(emitter in sbe)) sbe[emitter] = [];

        sbe[emitter].push([seq, vaaTime / 1000]);
      }

      page += 1;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // sort by sequence
  for (const emitter in sbe) {
    sbe[emitter] = sbe[emitter].sort((a: [bigint, number], b: [bigint, number]) =>
      Number(a[0] - b[0])
    );
  }

  return sbe;
}
