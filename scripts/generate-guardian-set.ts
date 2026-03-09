/**
 * Fetches the guardian set from the upstream wormhole repo and generates
 * TypeScript and Go source files so every service in this monorepo
 * shares a single source of truth.
 *
 * Usage:  npx tsx scripts/generate-guardian-set.ts
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const PROTOTXT_URL =
  'https://raw.githubusercontent.com/wormhole-foundation/wormhole/main/guardianset/mainnetv2/v5.prototxt';

// Version number parsed from the URL filename (e.g. "v5" → 5)
const VERSION = parseInt(PROTOTXT_URL.match(/v(\d+)\.prototxt$/)![1], 10);
const SET_NAME = `GUARDIAN_SET_${VERSION}`;

const ROOT = path.resolve(__dirname, '..');
const TS_OUT = path.join(ROOT, 'common', 'src', 'guardianSet.ts');
const GO_OUT = path.join(ROOT, 'fly', 'common', 'guardianSet.go');

interface Guardian {
  pubkey: string;
  name: string;
}

// ── fetch ────────────────────────────────────────────────────────────

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      })
      .on('error', reject);
  });
}

// ── parse prototxt ───────────────────────────────────────────────────

function parseProtoTxt(text: string): Guardian[] {
  const guardians: Guardian[] = [];
  const guardianBlocks = text.split(/guardians\s*:\s*\{/);
  // first element is the preamble (timestamp etc.), skip it
  for (let i = 1; i < guardianBlocks.length; i++) {
    const block = guardianBlocks[i];
    const pubkeyMatch = block.match(/pubkey\s*:\s*"([^"]+)"/);
    const nameMatch = block.match(/name\s*:\s*"([^"]+)"/);
    if (pubkeyMatch && nameMatch) {
      guardians.push({ pubkey: pubkeyMatch[1], name: nameMatch[1] });
    }
  }
  if (guardians.length === 0) {
    throw new Error('Parsed 0 guardians from prototxt — format may have changed');
  }
  return guardians;
}

// ── generate TypeScript ──────────────────────────────────────────────

function generateTS(guardians: Guardian[]): string {
  const entries = guardians
    .map((g) => `  {\n    pubkey: '${g.pubkey}',\n    name: '${g.name}',\n  }`)
    .join(',\n');

  return `// AUTO-GENERATED — do not edit manually.
// Source: ${PROTOTXT_URL}
// Run:    npm run generate-guardians

export const ${SET_NAME} = [
${entries},
];

/** Always points to the active guardian set. Update GUARDIAN_SET_N above and bump this alias. */
export const GUARDIAN_SET = ${SET_NAME};
`;
}

// ── generate Go ──────────────────────────────────────────────────────

function generateGo(guardians: Guardian[]): string {
  // MainnetGuardians slice
  const sliceEntries = guardians.map((g, i) => `\t{${i}, "${g.name}", "${g.pubkey}"}`).join(',\n');

  // guardianIndexMap
  const indexMapEntries = guardians
    .map((g, i) => `\tstrings.ToLower("${g.pubkey}"): ${i}`)
    .join(',\n');

  // guardianIndexToNameMap
  const nameMapEntries = guardians.map((g, i) => `\t${i}:  "${g.name}"`).join(',\n');

  return `// AUTO-GENERATED — do not edit manually.
// Source: ${PROTOTXT_URL}
// Run:    npm run generate-guardians

package common

import "strings"

var MainnetGuardians = []GuardianEntry{
${sliceEntries},
}

var guardianIndexMap = map[string]int{
${indexMapEntries},
}

var guardianIndexToNameMap = map[int]string{
${nameMapEntries},
}

func GetGuardianName(addr string) (string, bool) {
\tname, ok := guardianIndexToNameMap[guardianIndexMap[strings.ToLower(addr)]]
\treturn name, ok
}

func GetGuardianIndexToNameMap() map[int]string {
\treturn guardianIndexToNameMap
}
`;
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching ${PROTOTXT_URL} ...`);
  const text = await fetch(PROTOTXT_URL);

  const guardians = parseProtoTxt(text);
  console.log(`Parsed ${guardians.length} guardians`);

  const tsCode = generateTS(guardians);
  fs.writeFileSync(TS_OUT, tsCode);
  console.log(`Wrote ${TS_OUT}`);

  const goCode = generateGo(guardians);
  fs.writeFileSync(GO_OUT, goCode);
  console.log(`Wrote ${GO_OUT}`);

  console.log('\nGuardians:');
  guardians.forEach((g, i) => console.log(`  ${i}: ${g.name} — ${g.pubkey}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
