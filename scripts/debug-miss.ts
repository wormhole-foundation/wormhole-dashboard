/**
 * Debug stuck Wormhole messages by tracing each one through the pipeline:
 *
 *   1. Has the source-chain transaction reached finality (per the watcher)?
 *   2. If the chain is in the delegate set, have enough delegate signatures
 *      been observed to reach quorum of the delegate set?
 *   3. Is the message stuck in the governor (held by some guardians)?
 *   4. Is the message stuck in the accountant (pending committal)?
 *   5. Has the message received enough guardian observations for quorum?
 *
 * The script reports the first stage that the message has not cleared, which
 * is where it is currently stuck.
 *
 * Usage:
 *   npx tsx scripts/debug-miss.ts                          # all current misses
 *   npx tsx scripts/debug-miss.ts <chain>/<emitter>/<seq>  # one specific VAA
 *   npx tsx scripts/debug-miss.ts --all                    # do not apply the miss threshold filter
 *   npx tsx scripts/debug-miss.ts --csv <path>             # also write a CSV report to <path>
 */

import axios from 'axios';
import { ethers } from 'ethers';
import * as fs from 'fs';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  GUARDIAN_SET,
  chainIdToName,
  getMissThreshold,
  queryContractSmart,
} from '@wormhole-foundation/wormhole-monitor-common';

// ── endpoints ────────────────────────────────────────────────────────

const MESSAGE_DB_ENDPOINT = 'https://europe-west3-wormhole-message-db-mainnet.cloudfunctions.net';
const WORMHOLESCAN_API = 'https://api.wormholescan.io/api/v1';
const WORMCHAIN_RPC = 'https://wormchain.mainnet.xlabs.xyz';
const ETH_RPC = 'https://ethereum-rpc.publicnode.com';
const DELEGATED_GUARDIAN_CONTRACT = '0x1462800febd49232798132e8c8b721aa86c4c209';

// ── types ────────────────────────────────────────────────────────────

interface ObservedMessage {
  id: string;
  chain: number;
  block: number;
  emitter: string;
  seq: string;
  timestamp: string;
  txHash: string;
  hasSignedVaa: 0 | 1;
}

type MissesByChain = {
  [chainId: string]: {
    messages: ObservedMessage[];
    lastUpdated: number;
    lastRowKey: string;
  };
};

interface DelegateConfigEntry {
  chainId: number;
  threshold: number;
  numGuardians: number;
  keys: string[];
}

type DelegateConfigMap = { [chainId: number]: DelegateConfigEntry };

interface ScanObservation {
  // Canonical observations endpoint returns this:
  guardianAddr?: string;
  // Delegate observations endpoint returns this instead:
  delegatedGuardianAddr?: string;
  signature: string;
  hash: string;
  txHash?: string;
  emitterChain?: number;
}

interface GovernorStatusResponse {
  governorStatus: {
    guardianAddress: string;
    chains: {
      chainId: number;
      emitters: {
        emitterAddress: string;
        enqueuedVaas: { sequence: string; txHash: string }[];
      }[];
    }[];
  }[];
}

// ── helpers ──────────────────────────────────────────────────────────

const TOTAL_GUARDIANS = GUARDIAN_SET.length;
// Wormhole quorum = floor(2 * n / 3) + 1
const fullQuorum = (n: number) => Math.floor((2 * n) / 3) + 1;

function nameForGuardianAddr(addr: string | undefined): string {
  if (!addr) return '(unknown)';
  const lower = addr.toLowerCase().replace(/^0x/, '');
  const hit = GUARDIAN_SET.find((g) => g.pubkey.toLowerCase().replace(/^0x/, '') === lower);
  return hit ? hit.name : addr;
}

// `delegate.keys` is the subset of canonical guardian addresses that the
// delegated-guardian contract has configured to sign for this chain. A
// delegate address therefore resolves to a name by direct lookup in the
// canonical guardian set, same as any other guardian observation.
function nameForDelegateAddr(addr: string | undefined): string {
  return nameForGuardianAddr(addr);
}

function normalizeEmitter(emitter: string): string {
  return emitter.toLowerCase().replace(/^0x/, '');
}

async function tryGet<T>(url: string): Promise<T | null> {
  try {
    const r = await axios.get<T>(url, { timeout: 30_000 });
    return r.data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

// ── data fetchers ────────────────────────────────────────────────────

async function fetchMisses(): Promise<MissesByChain> {
  const r = await axios.get<MissesByChain>(`${MESSAGE_DB_ENDPOINT}/missing-vaas`);
  return r.data;
}

async function fetchLatestBlocks(): Promise<{ [chainId: string]: string }> {
  const r = await axios.get<{ [chainId: string]: string }>(`${MESSAGE_DB_ENDPOINT}/latest-blocks`);
  return r.data;
}

async function fetchGovernorStatus(): Promise<GovernorStatusResponse> {
  const r = await axios.get<GovernorStatusResponse>(`${MESSAGE_DB_ENDPOINT}/governor-status`);
  return r.data;
}

async function fetchDelegateConfig(): Promise<DelegateConfigMap> {
  const abi = [
    'function getConfig() view returns (tuple(uint16 chainId, uint32 timestamp, uint8 threshold, address[] keys)[])',
  ];
  const provider = new ethers.providers.JsonRpcProvider(ETH_RPC);
  const contract = new ethers.Contract(DELEGATED_GUARDIAN_CONTRACT, abi, provider);
  const result: any[] = await contract.getConfig();
  const map: DelegateConfigMap = {};
  for (const entry of result) {
    // ethers v5 returns named tuples positionally too; key name "keys" can
    // collide with Array.prototype, so we read by index.
    const chainId = Number(entry[0]);
    const threshold = Number(entry[2]);
    const guardianKeys: string[] = entry[3];
    map[chainId] = {
      chainId,
      threshold,
      numGuardians: guardianKeys.length,
      keys: guardianKeys.map((k) => k.toLowerCase()),
    };
  }
  return map;
}

async function fetchObservations(
  chain: number,
  emitter: string,
  seq: string
): Promise<ScanObservation[]> {
  const url = `${WORMHOLESCAN_API}/observations/${chain}/${normalizeEmitter(emitter)}/${seq}`;
  return (await tryGet<ScanObservation[]>(url)) ?? [];
}

interface SignedVaaResponse {
  vaaBytes?: string;
}

// Returns the base64 vaa bytes if the VAA is available on Wormholescan,
// otherwise null. Wormholescan returns 404 when no signed VAA exists yet.
async function fetchSignedVaa(chain: number, emitter: string, seq: string): Promise<string | null> {
  const url = `${WORMHOLESCAN_API.replace('/api/v1', '/v1')}/signed_vaa/${chain}/${normalizeEmitter(
    emitter
  )}/${seq}`;
  const r = await tryGet<SignedVaaResponse>(url);
  return r?.vaaBytes ?? null;
}

async function fetchDelegateObservations(
  chain: number,
  emitter: string,
  seq: string
): Promise<ScanObservation[]> {
  const url = `${WORMHOLESCAN_API}/observations/delegate/${chain}/${normalizeEmitter(
    emitter
  )}/${seq}`;
  return (await tryGet<ScanObservation[]>(url)) ?? [];
}

interface AccountantTransferStatus {
  pending?: { signatures: string; tx_hash: string; digest: string }[];
  committed?: { data: any; digest: string };
}

async function fetchAccountantStatus(
  chain: number,
  emitter: string,
  seq: string
): Promise<AccountantTransferStatus | null> {
  try {
    const r = await queryContractSmart(WORMCHAIN_RPC, ACCOUNTANT_CONTRACT_ADDRESS, {
      transfer_status: {
        emitter_chain: chain,
        emitter_address: normalizeEmitter(emitter),
        sequence: Number(seq),
      },
    });
    return r as AccountantTransferStatus;
  } catch (e: any) {
    // Accountant returns an error for unknown / non-token-bridge transfers
    return null;
  }
}

function countSignatureBits(signatures: string): { count: number; names: string[] } {
  let bitfield = BigInt(signatures);
  const names: string[] = [];
  let idx = 0;
  let count = 0;
  while (bitfield > 0n) {
    if (bitfield & 1n) {
      count++;
      const guardian = GUARDIAN_SET[idx];
      if (guardian) names.push(guardian.name);
    }
    bitfield >>= 1n;
    idx++;
  }
  return { count, names };
}

// ── stage analysis ───────────────────────────────────────────────────

interface StageReport {
  name: string;
  status: 'cleared' | 'stuck' | 'n/a';
  detail: string;
}

interface StageMetrics {
  vaaAvailableStatus: 'cleared' | 'stuck';
  finalityStatus: 'cleared' | 'stuck' | 'n/a';
  finalityWatcherBlock: number | null;
  delegateStatus: 'cleared' | 'stuck' | 'n/a';
  delegateHave: number | null;
  delegateThreshold: number | null;
  delegateSetSize: number | null;
  delegateMissing: string[];
  governorStatus: 'cleared' | 'stuck';
  governorHolders: string[];
  accountantStatus: 'cleared' | 'stuck' | 'n/a';
  accountantSigs: number | null;
  accountantQuorum: number | null;
  accountantMissing: string[];
  observationsStatus: 'cleared' | 'stuck';
  observationsCount: number;
  observationsQuorum: number;
}

interface AnalyzeResult {
  stages: StageReport[];
  metrics: StageMetrics;
  stuckAt: string | null;
  observationsCleared: boolean;
  vaaAvailable: boolean;
}

async function analyzeMiss(
  chain: number,
  miss: ObservedMessage,
  ctx: {
    latestBlocks: { [chainId: string]: string };
    delegateConfig: DelegateConfigMap;
    governorStatus: GovernorStatusResponse;
  }
): Promise<AnalyzeResult> {
  const stages: StageReport[] = [];
  const metrics: StageMetrics = {
    vaaAvailableStatus: 'stuck',
    finalityStatus: 'n/a',
    finalityWatcherBlock: null,
    delegateStatus: 'n/a',
    delegateHave: null,
    delegateThreshold: null,
    delegateSetSize: null,
    delegateMissing: [],
    governorStatus: 'cleared',
    governorHolders: [],
    accountantStatus: 'n/a',
    accountantSigs: null,
    accountantQuorum: null,
    accountantMissing: [],
    observationsStatus: 'stuck',
    observationsCount: 0,
    observationsQuorum: fullQuorum(TOTAL_GUARDIANS),
  };
  const { emitter, seq, block } = miss;

  // Kick off the network-bound queries in parallel up front.
  const delegate = ctx.delegateConfig[chain];
  const [signedVaa, delegateObs, accountantStatus, observations] = await Promise.all([
    fetchSignedVaa(chain, emitter, seq),
    delegate ? fetchDelegateObservations(chain, emitter, seq) : Promise.resolve([]),
    fetchAccountantStatus(chain, emitter, seq),
    fetchObservations(chain, emitter, seq),
  ]);

  // 0. VAA availability — if the signed VAA is already published, the miss is
  // stale and there is nothing to debug downstream.
  if (signedVaa) {
    metrics.vaaAvailableStatus = 'cleared';
    stages.push({
      name: '0. VAA availability',
      status: 'cleared',
      detail: `signed VAA is available on Wormholescan (${signedVaa.length} base64 chars)`,
    });
  } else {
    stages.push({
      name: '0. VAA availability',
      status: 'stuck',
      detail: 'no signed VAA available yet from Wormholescan',
    });
  }

  // 1. Finality (per the watcher's view)
  const raw = ctx.latestBlocks[String(chain)];
  if (!raw) {
    stages.push({
      name: '1. Finality',
      status: 'n/a',
      detail: 'no latest-block report for this chain',
    });
  } else {
    const [latestBlockStr] = raw.split('/');
    const latestBlock = Number(latestBlockStr);
    metrics.finalityWatcherBlock = Number.isFinite(latestBlock) ? latestBlock : null;
    if (Number.isFinite(latestBlock) && latestBlock < block) {
      metrics.finalityStatus = 'stuck';
      stages.push({
        name: '1. Finality',
        status: 'stuck',
        detail: `tx in block ${block}, watcher latest indexed ${latestBlock}`,
      });
    } else {
      metrics.finalityStatus = 'cleared';
      stages.push({
        name: '1. Finality',
        status: 'cleared',
        detail: `tx block ${block} <= watcher latest ${latestBlockStr}`,
      });
    }
  }

  // 2. Delegate set quorum
  if (!delegate) {
    stages.push({
      name: '2. Delegate set',
      status: 'n/a',
      detail: 'chain not in delegate set',
    });
  } else {
    // The same guardian can appear more than once (key rotation, reobservation,
    // etc.); quorum is per unique guardian.
    const allSigners = Array.from(
      new Set(delegateObs.map((o) => (o.delegatedGuardianAddr ?? '').toLowerCase()).filter(Boolean))
    );
    // Only count signatures from guardians currently in the chain's delegate
    // set. Observations from rotated-out delegates don't contribute to quorum.
    const delegateKeySet = new Set(delegate.keys);
    const uniqueSigners = allSigners.filter((s) => delegateKeySet.has(s));
    const signers = uniqueSigners.map((a) => nameForDelegateAddr(a));
    const have = uniqueSigners.length;
    // Missing = chain's configured delegate guardians that haven't signed yet.
    const missing = delegate.keys
      .filter((key) => !uniqueSigners.includes(key))
      .map((key) => nameForDelegateAddr(key));
    metrics.delegateHave = have;
    metrics.delegateThreshold = delegate.threshold;
    metrics.delegateSetSize = delegate.numGuardians;
    metrics.delegateMissing = missing;
    if (have >= delegate.threshold) {
      metrics.delegateStatus = 'cleared';
      stages.push({
        name: '2. Delegate set',
        status: 'cleared',
        detail: `${have}/${delegate.threshold} delegate signatures (set size ${
          delegate.numGuardians
        }) — ${signers.join(', ') || 'none'}`,
      });
    } else {
      metrics.delegateStatus = 'stuck';
      stages.push({
        name: '2. Delegate set',
        status: 'stuck',
        detail: `${have}/${delegate.threshold} delegate signatures (set size ${
          delegate.numGuardians
        }) — have: ${signers.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`,
      });
    }
  }

  // 3. Governor
  const govHolders: string[] = [];
  for (const guardianStatus of ctx.governorStatus.governorStatus) {
    for (const c of guardianStatus.chains) {
      if (c.chainId !== chain) continue;
      for (const e of c.emitters) {
        if (normalizeEmitter(e.emitterAddress) !== normalizeEmitter(emitter)) continue;
        if (e.enqueuedVaas.some((v) => String(v.sequence) === String(seq))) {
          govHolders.push(nameForGuardianAddr(guardianStatus.guardianAddress));
        }
      }
    }
  }
  metrics.governorHolders = govHolders;
  if (govHolders.length === 0) {
    metrics.governorStatus = 'cleared';
    stages.push({
      name: '3. Governor',
      status: 'cleared',
      detail: 'no guardians report this VAA as enqueued',
    });
  } else {
    metrics.governorStatus = 'stuck';
    stages.push({
      name: '3. Governor',
      status: 'stuck',
      detail: `held by ${govHolders.length} guardian(s): ${govHolders.join(', ')}`,
    });
  }

  // 4. Accountant
  const acct = accountantStatus;
  if (!acct) {
    stages.push({
      name: '4. Accountant',
      status: 'n/a',
      detail: 'not tracked by accountant (non-token-bridge or unknown)',
    });
  } else if (acct.committed) {
    metrics.accountantStatus = 'cleared';
    stages.push({
      name: '4. Accountant',
      status: 'cleared',
      detail: 'committed',
    });
  } else if (acct.pending && acct.pending.length > 0) {
    const sigs = acct.pending[0].signatures;
    const { count, names } = countSignatureBits(sigs);
    const need = fullQuorum(TOTAL_GUARDIANS);
    const missing = GUARDIAN_SET.map((g) => g.name).filter((n) => !names.includes(n));
    metrics.accountantSigs = count;
    metrics.accountantQuorum = need;
    metrics.accountantMissing = missing;
    metrics.accountantStatus = count >= need ? 'cleared' : 'stuck';
    stages.push({
      name: '4. Accountant',
      status: count >= need ? 'cleared' : 'stuck',
      detail: `pending ${count}/${need} sigs — have: ${names.join(', ') || 'none'}; missing: ${
        missing.join(', ') || 'none'
      }`,
    });
  } else {
    stages.push({
      name: '4. Accountant',
      status: 'n/a',
      detail: 'no status returned',
    });
  }

  // 5. Observations — only count observations from guardians currently in the
  // canonical guardian set; rotated-out guardians don't contribute to quorum.
  const obs = observations;
  const canonicalKeySet = new Set(GUARDIAN_SET.map((g) => g.pubkey.toLowerCase()));
  const allObservers = Array.from(
    new Set(obs.map((o) => (o.guardianAddr ?? '').toLowerCase()).filter(Boolean))
  );
  const uniqueObservers = allObservers.filter((a) => canonicalKeySet.has(a));
  const observers = uniqueObservers.map((a) => nameForGuardianAddr(a));
  const observerCount = uniqueObservers.length;
  const need = fullQuorum(TOTAL_GUARDIANS);
  metrics.observationsCount = observerCount;
  metrics.observationsQuorum = need;
  if (observerCount >= need) {
    metrics.observationsStatus = 'cleared';
    stages.push({
      name: '5. Observations',
      status: 'cleared',
      detail: `${observerCount}/${need} of ${TOTAL_GUARDIANS} guardians observed — ${observers.join(
        ', '
      )}`,
    });
  } else {
    metrics.observationsStatus = 'stuck';
    const missing = GUARDIAN_SET.map((g) => g.name).filter((n) => !observers.includes(n));
    stages.push({
      name: '5. Observations',
      status: 'stuck',
      detail: `${observerCount}/${need} of ${TOTAL_GUARDIANS} guardians observed — have: ${
        observers.join(', ') || 'none'
      }; missing: ${missing.join(', ')}`,
    });
  }

  // If the signed VAA is available, the miss is stale; nothing is actually
  // stuck. Otherwise, if observations have reached quorum, the VAA was signed
  // and propagation/index lag is the most likely explanation.
  const vaaAvailable = stages.find((s) => s.name.startsWith('0.'))?.status === 'cleared';
  const observationsCleared = stages.find((s) => s.name.startsWith('5.'))?.status === 'cleared';
  const firstStuck =
    stages.filter((s) => !s.name.startsWith('0.')).find((s) => s.status === 'stuck')?.name ?? null;
  const stuckAt = vaaAvailable || observationsCleared ? null : firstStuck;
  return { stages, metrics, stuckAt, observationsCleared, vaaAvailable };
}

// ── reporting ────────────────────────────────────────────────────────

function printMissReport(chain: number, miss: ObservedMessage, report: AnalyzeResult) {
  const chainName = chainIdToName(chain);
  const vaaId = `${chain}/${normalizeEmitter(miss.emitter)}/${miss.seq}`;
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`VAA   ${vaaId}  (${chainName})`);
  console.log(`Tx    ${miss.txHash}`);
  console.log(`Block ${miss.block}`);
  console.log(`Seen  ${new Date(miss.timestamp).toISOString()}`);
  console.log('───────────────────────────────────────────────────────────────────');
  for (const s of report.stages) {
    const marker = s.status === 'cleared' ? '✓' : s.status === 'stuck' ? '✗' : '·';
    console.log(`  ${marker} ${s.name}: ${s.status.toUpperCase()}`);
    console.log(`      ${s.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  if (report.vaaAvailable) {
    console.log('STUCK AT: nothing — signed VAA is available, miss is stale');
  } else if (report.stuckAt) {
    console.log(`STUCK AT: ${report.stuckAt}`);
  } else if (report.observationsCleared) {
    console.log(
      'STUCK AT: nothing — observations reached quorum, VAA was signed (miss likely reflects cache/index lag)'
    );
  } else {
    console.log('STUCK AT: nothing — message has cleared every checked stage');
  }
}

// ── CSV output ───────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'vaa_id',
  'chain_id',
  'chain_name',
  'emitter',
  'sequence',
  'tx_hash',
  'block',
  'seen',
  'vaa_available',
  'finality',
  'finality_watcher_block',
  'delegate',
  'delegate_have',
  'delegate_threshold',
  'delegate_set_size',
  'delegate_missing',
  'governor',
  'governor_holders_count',
  'governor_holders',
  'accountant',
  'accountant_sigs',
  'accountant_quorum',
  'accountant_missing',
  'observations',
  'observations_count',
  'observations_quorum',
  'stuck_at',
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvHeader(): string {
  return CSV_COLUMNS.join(',') + '\n';
}

function csvRow(chain: number, miss: ObservedMessage, report: AnalyzeResult): string {
  const vaaId = `${chain}/${normalizeEmitter(miss.emitter)}/${miss.seq}`;
  const m = report.metrics;
  const stuckAt = report.vaaAvailable
    ? 'none (signed VAA available — miss is stale)'
    : report.stuckAt
    ? report.stuckAt
    : report.observationsCleared
    ? 'none (observations reached quorum — likely cache/index lag)'
    : 'none';
  const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
    vaa_id: vaaId,
    chain_id: chain,
    chain_name: chainIdToName(chain),
    emitter: normalizeEmitter(miss.emitter),
    sequence: miss.seq,
    tx_hash: miss.txHash,
    block: miss.block,
    seen: miss.timestamp ? new Date(miss.timestamp).toISOString() : '',
    vaa_available: m.vaaAvailableStatus === 'cleared' ? 'yes' : 'no',
    finality: m.finalityStatus,
    finality_watcher_block: m.finalityWatcherBlock ?? '',
    delegate: m.delegateStatus,
    delegate_have: m.delegateHave ?? '',
    delegate_threshold: m.delegateThreshold ?? '',
    delegate_set_size: m.delegateSetSize ?? '',
    delegate_missing: m.delegateMissing.join('; '),
    governor: m.governorStatus,
    governor_holders_count: m.governorHolders.length,
    governor_holders: m.governorHolders.join('; '),
    accountant: m.accountantStatus,
    accountant_sigs: m.accountantSigs ?? '',
    accountant_quorum: m.accountantQuorum ?? '',
    accountant_missing: m.accountantMissing.join('; '),
    observations: m.observationsStatus,
    observations_count: m.observationsCount,
    observations_quorum: m.observationsQuorum,
    stuck_at: stuckAt,
  };
  return CSV_COLUMNS.map((c) => csvEscape(row[c])).join(',') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────

function parseCsvPath(args: string[]): string | null {
  const eq = args.find((a) => a.startsWith('--csv='));
  if (eq) return eq.slice('--csv='.length);
  const idx = args.indexOf('--csv');
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const csvPath = parseCsvPath(args);
  const explicitId = args.find((a) => /^\d+\/[0-9a-fA-Fx]+\/\d+$/.test(a));

  const csvStream = csvPath ? fs.createWriteStream(csvPath) : null;
  if (csvStream) {
    csvStream.write(csvHeader());
    console.log(`Writing CSV report to ${csvPath}`);
  }

  console.log('Loading delegate set, governor status, latest blocks...');
  const [latestBlocks, delegateConfig, governorStatus] = await Promise.all([
    fetchLatestBlocks(),
    fetchDelegateConfig(),
    fetchGovernorStatus(),
  ]);
  console.log(`Delegate set covers chain ids: ${Object.keys(delegateConfig).join(', ') || 'none'}`);

  const ctx = { latestBlocks, delegateConfig, governorStatus };

  if (explicitId) {
    const [chainStr, emitter, seq] = explicitId.split('/');
    const chain = Number(chainStr);
    // Synthesize a minimal miss from args; we won't have block / timestamp / txHash.
    const synthetic: ObservedMessage = {
      id: explicitId,
      chain,
      block: 0,
      emitter,
      seq,
      timestamp: new Date(0).toISOString(),
      txHash: '(unknown — provided by VAA id)',
      hasSignedVaa: 0,
    };
    const report = await analyzeMiss(chain, synthetic, ctx);
    printMissReport(chain, synthetic, report);
    if (csvStream) {
      csvStream.write(csvRow(chain, synthetic, report));
      csvStream.end();
    }
    return;
  }

  console.log('Fetching missing VAAs...');
  const misses = await fetchMisses();

  const now = new Date();
  const filtered: { chain: number; miss: ObservedMessage }[] = [];
  for (const [chainStr, info] of Object.entries(misses)) {
    const chain = Number(chainStr);
    const threshold = getMissThreshold(now, chainStr);
    for (const m of info.messages) {
      if (showAll || m.timestamp < threshold) {
        filtered.push({ chain, miss: m });
      }
    }
  }

  if (filtered.length === 0) {
    console.log(`No misses${showAll ? '' : ' older than the miss threshold'} found.`);
    return;
  }

  console.log(
    `Analyzing ${filtered.length} miss(es)${showAll ? '' : ' older than the miss threshold'}...`
  );

  for (const { chain, miss } of filtered) {
    try {
      const report = await analyzeMiss(chain, miss, ctx);
      printMissReport(chain, miss, report);
      if (csvStream) csvStream.write(csvRow(chain, miss, report));
    } catch (e: any) {
      console.error(`\nFailed to analyze ${chain}/${miss.emitter}/${miss.seq}: ${e?.message ?? e}`);
    }
  }

  if (csvStream) {
    await new Promise<void>((resolve) => csvStream.end(resolve));
    console.log(`\nCSV report written to ${csvPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
