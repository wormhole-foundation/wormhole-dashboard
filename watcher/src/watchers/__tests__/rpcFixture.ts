import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import { Commitment, Connection } from '@solana/web3.js';
import { jest, test } from '@jest/globals';

// Record/replay of JSON-RPC calls so watcher tests that assert on specific
// historical blocks are deterministic and offline (the underlying blocks get
// pruned from public RPCs over time).
//
//   REPLAY (default): responses come from the committed fixture; no network.
//   RECORD (RECORD_FIXTURES=1): calls go to the live RPC and the ordered
//   responses are written to the fixture. Point the watcher at an archival RPC
//   when recording ranges that public nodes have pruned.
//
// Replay is order-based (single-threaded watchers issue calls deterministically),
// which keeps fixtures readable and avoids brittle request-matching.
const RECORD = process.env.RECORD_FIXTURES === '1';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const fixturePath = (name: string) => join(FIXTURES, name);

// Runs the test when its fixture exists (or when recording), else skips it — so
// the suite stays green until someone records the fixture, then it auto-activates.
export function fixtureTest(name: string): typeof test | typeof test.skip {
  return RECORD || fs.existsSync(fixturePath(name)) ? test : test.skip;
}
const loadFixture = (name: string): unknown[] =>
  JSON.parse(fs.readFileSync(fixturePath(name), 'utf8'));
function saveFixture(name: string, entries: unknown[]): void {
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(fixturePath(name), JSON.stringify(entries, null, 2) + '\n');
}

// --- EVM watchers: intercept axios.post (the JSON-RPC transport) ---
export async function withRpcReplay(name: string, fn: () => Promise<void>): Promise<void> {
  if (RECORD) {
    const orig = axios.post.bind(axios);
    const entries: unknown[] = [];
    const spy = jest
      .spyOn(axios, 'post')
      .mockImplementation(async (url: string, body?: unknown, cfg?: unknown) => {
        const res: any = await orig(url as any, body as any, cfg as any);
        entries.push(res.data);
        return res;
      });
    try {
      await fn();
    } finally {
      spy.mockRestore();
      saveFixture(name, entries);
    }
  } else {
    const entries = loadFixture(name);
    let i = 0;
    const spy = jest.spyOn(axios, 'post').mockImplementation(async () => {
      if (i >= entries.length) throw new Error(`rpcFixture: ${name} exhausted at call ${i}`);
      return { data: entries[i++], status: 200, statusText: 'OK', headers: {}, config: {} as any };
    });
    try {
      await fn();
    } finally {
      spy.mockRestore();
    }
  }
}

// Response ids must echo the request ids or web3.js's client rejects them.
function echoIds(reqBody: string, resText: string): string {
  const req = JSON.parse(reqBody);
  const res = JSON.parse(resText);
  if (Array.isArray(req) && Array.isArray(res)) {
    res.forEach((r: any, k: number) => {
      if (req[k]) r.id = req[k].id;
    });
  } else if (!Array.isArray(req) && !Array.isArray(res)) {
    res.id = req.id;
  }
  return JSON.stringify(res);
}

// --- SVM watchers: inject a custom fetch into web3.js's Connection ---
// Call after constructing the watcher, before exercising it.
export function installSolanaReplay(
  watcher: { rpc: string; connection?: Connection },
  name: string,
  commitment: Commitment = 'finalized'
): void {
  if (RECORD) {
    const entries: string[] = [];
    const fetchFn = async (url: any, init: any): Promise<Response> => {
      const res = await fetch(url, init);
      const text = await res.text();
      entries.push(text);
      saveFixture(name, entries); // written incrementally so partial records survive
      return new Response(text, { status: res.status });
    };
    // RECORD_RPC lets you record against an archival endpoint without editing the test.
    const rpc = process.env.RECORD_RPC || watcher.rpc;
    watcher.connection = new Connection(rpc, { commitment, fetch: fetchFn as any });
  } else {
    const entries = loadFixture(name) as string[];
    let i = 0;
    const fetchFn = async (_url: any, init: any): Promise<Response> => {
      if (i >= entries.length) throw new Error(`rpcFixture: ${name} exhausted at call ${i}`);
      const body = typeof init?.body === 'string' ? init.body : '[]';
      return new Response(echoIds(body, entries[i++]), { status: 200 });
    };
    watcher.connection = new Connection(watcher.rpc, { commitment, fetch: fetchFn as any });
  }
}
