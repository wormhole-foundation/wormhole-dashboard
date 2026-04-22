# cloud_functions

Google Cloud Functions backing the dashboard and downstream consumers.

## Overview

Functions fall into three buckets: **read endpoints** (public HTTP, cached
Firestore reads), **compute jobs** (scheduled cron writers that populate the
Firestore docs the read endpoints serve), and **alarms** (cron-driven,
post to Slack / PagerDuty).

### Read endpoints

| endpoint                       | entry point                        | source of truth                           | primary consumer                                                                                                                                         |
| ------------------------------ | ---------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/tvl`                         | `getTVL`                           | `FIRESTORE_TVL_COLLECTION`                | external (wormholescan, [governor](https://github.com/djb15/wormhole/blob/eddeef92a198b68983e6b4ab48ecd578e6bbca8e/node/hack/governor/src/index.ts#L70)) |
| `/latest-tokendata`            | `getLatestTokenData`               | `FIRESTORE_LATEST_TOKEN_DATA_COLLECTION`  | dashboard `useTokenData`                                                                                                                                 |
| `/guardian-heartbeats`         | `getGuardianHeartbeats`            | Firestore `heartbeats`                    | dashboard `getLastHeartbeats`                                                                                                                            |
| `/governor-configs`            | `getGovernorConfigs`               | Firestore `governorConfigs`               | dashboard `useCloudGovernorInfo`                                                                                                                         |
| `/governor-status`             | `getGovernorStatus`                | Firestore `governorStatus`                | dashboard `useCloudGovernorInfo`                                                                                                                         |
| `/latest-blocks`               | `getLatestBlocks`                  | `FIRESTORE_LATEST_COLLECTION`             | dashboard `useMonitorInfo`                                                                                                                               |
| `/message-counts`              | `getMessageCounts`                 | Bigtable                                  | dashboard `useMonitorInfo`                                                                                                                               |
| `/messages`                    | `getMessages`                      | Bigtable                                  | dashboard `Monitor`                                                                                                                                      |
| `/missing-vaas`                | `getMissingVaas`                   | Bigtable                                  | dashboard `useMonitorInfo` + watcher scripts                                                                                                             |
| `/get-guardian-set-info`       | `getGuardianSetInfo`               | `FIRESTORE_GUARDIAN_SET_INFO_COLLECTION`  | dashboard `useGetGuardianSetInfoByChain`                                                                                                                 |
| `/get-ntt-rate-limits`         | `getNTTRateLimits`                 | on-chain RPC                              | dashboard `useRateLimits`                                                                                                                                |
| `/get-total-supply-and-locked` | `getTotalSupplyAndLocked`          | on-chain RPC                              | dashboard `useTotalSupplyAndLocked`                                                                                                                      |
| `/get-quorum-height`           | `getQuorumHeight`                  | Firestore `heartbeats`                    | external queries integrators                                                                                                                             |
| `/get-solana-events`           | `getSolanaEvents`                  | Solana RPC                                | external [defillama](https://github.com/DefiLlama/bridges-server/blob/9d05756f0b83b0b6c84c04e85fc40cadca431f04/src/adapters/portal/index.ts#L297)        |
| `/reobserve-vaas`              | `getReobserveVaas` (API-key gated) | `FIRESTORE_ALARM_MISSING_VAAS_COLLECTION` | guardians                                                                                                                                                |

### Compute jobs (cron → Firestore / Bigtable)

| deploy                            | entry point                   | purpose                                                                |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `compute-tvl`                     | `computeTVL`                  | rebuild `tvl` doc + `latest-tokendata` doc from accountant + CoinGecko |
| `compute-guardian-set-info`       | `computeGuardianSetInfo`      | populate `FIRESTORE_GUARDIAN_SET_INFO_COLLECTION`                      |
| `compute-message-counts`          | `computeMessageCounts`        | aggregate Bigtable → message counts                                    |
| `compute-missing-vaas`            | `computeMissingVaas`          | find VAAs with no counterpart                                          |
| `compute-ntt-rate-limits`         | `computeNTTRateLimits`        | snapshot on-chain NTT rate limits                                      |
| `compute-total-supply-and-locked` | `computeTotalSupplyAndLocked` | snapshot on-chain NTT supply / locked                                  |

### Alarms

| deploy               | entry point        | purpose                                                                        |
| -------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `alarm-missing-vaas` | `alarmMissingVaas` | Slack when missing-VAAs list grows                                             |
| `wormchain-monitor`  | `wormchainMonitor` | Slack + PagerDuty when Wormchain / Evmos / Osmosis / Kujira RPCs are unhealthy |

Running locally: https://cloud.google.com/functions/docs/running/function-frameworks

## Running a function locally

`src/index.ts` routes to a module by the `FUNCTION` env var, and the package
ships `@google-cloud/functions-framework`. From `cloud_functions/`:

1. **Build.** The framework loads from `dist/`.

   ```bash
   npx tsc
   ```

2. **Create `.env`** (auto-loaded via `import 'dotenv/config'`). Minimum for
   `computeTVL`:

   ```
   FUNCTION=computeTVL
   FIRESTORE_TVL_COLLECTION=tvl-dev
   FIRESTORE_TVL_METADATA_COLLECTION=tvl-token-metadata-dev
   FIRESTORE_LATEST_TOKEN_DATA_COLLECTION=latest-tokendata-dev
   # optional (pro CoinGecko key; recommended for first-run cache seed):
   # COINGECKO_API_KEY=<pro key>
   GOOGLE_APPLICATION_CREDENTIALS=../serviceAccount.json
   GOOGLE_CLOUD_PROJECT=wormhole-message-db-mainnet
   ```

   Use `-dev`-suffixed Firestore collections so local runs don't overwrite the
   prod `tvl`, metadata cache, or `/latest-tokendata` docs. Firestore creates
   collections lazily on first write.

3. **Start the framework.** `--source` points directly at the compiled
   module so you can bypass the `FUNCTION`-env dispatcher in
   `dist/index.js` (useful when running multiple functions in parallel
   shells).

   ```bash
   npx functions-framework --target=computeTVL \
     --source=dist/computeTVL.js --signature-type=http
   ```

   Listens on `:8080`.

4. **Invoke.**

   ```bash
   curl -v http://localhost:8080
   ```

   Watch the logs for the accountant pagination count, cache load, resolver
   progress, and `Computed TVL: $...`. Re-running should print
   `Need to resolve 0 tokens` once the cache is seeded.

5. **Inspect output.** Read `tvl-dev/tvl` or `latest-tokendata-dev/latest` in
   the Firestore console, or run the read-side functions locally in
   additional shells:

   ```bash
   npx functions-framework --target=getTVL \
     --source=dist/getTVL.js --signature-type=http --port=8081
   curl http://localhost:8081 | jq '.AllTime."*"'

   npx functions-framework --target=getLatestTokenData \
     --source=dist/getLatestTokenData.js --signature-type=http --port=8082
   curl http://localhost:8082 | jq '.data | length'
   ```

### Caveats

- On the free CoinGecko tier (~30 req/min) the first run against an empty
  metadata cache will trip `RESOLVE_DEADLINE_MS` well before resolving all
  ~3k tokens. Either set `COINGECKO_API_KEY` or invoke the function back to
  back a handful of times — each run persists what it resolved, so the
  cache converges.
- `GOOGLE_APPLICATION_CREDENTIALS` must point at a service account with
  Firestore read/write on the target project.
- To smoke-test without touching Firestore at all, comment out the final
  `firestore.collection(tvlCollection).doc('tvl').set(notionalTvl)` call and
  log the result instead.

## Deploying

See `scripts/deploy.sh`. Export env vars (see `.env.sample`) first, then run the
script. Deploy commands follow this pattern:

```
gcloud functions deploy <name> \
  --entry-point <exportedFunction> \
  --runtime nodejs22 --trigger-http \
  --timeout <seconds> --memory <N>GB \
  --region <location> \
  --set-env-vars K1=V1,K2=V2
```

- `<name>` is the URL slug (`https://<location>-<project>.cloudfunctions.net/<name>`).
- `<exportedFunction>` is re-exported from `src/index.ts`.
- Compute functions share Firestore / Cloud Storage caches. They're currently
  `--allow-unauthenticated` so caches can be refreshed manually; a Cloud Scheduler
  cron triggers them on a schedule.

## TVL

Two cloud functions cooperate behind the `/tvl` endpoint:

- **`compute-tvl`** (`computeTVL`) — scheduled job that rebuilds the TVL doc.
- **`tvl`** (`getTVL`) — public read-through endpoint that serves a cached copy
  of the Firestore doc produced by `compute-tvl`.

### Endpoint: `GET /tvl`

Response shape (`NotionalTVL` from
`@wormhole-foundation/wormhole-monitor-common`):

```jsonc
{
  "Last24HoursChange": {},           // reserved; currently empty
  "AllTime": {
    "*": { "*": { "Notional": 1751828066.93, ... } },   // grand total
    "<tokenChainId>": {
      "*": { "Notional": <chain total>, ... },           // per-chain total
      "<nativeAddress>": {                               // per-token
        "Address": "<native address>",
        "Amount": <amount scaled by decimals>,
        "CoinGeckoId": "<coingecko id>",
        "Name": "<token name>",
        "Notional": <amount * usd price>,
        "Symbol": "<ticker>",
        "TokenDecimals": <decimals>,
        "TokenPrice": <usd per token>
      },
      ...
    }
  }
}
```

The `tvl` function caches the Firestore read in memory for one hour. It only
reads one doc per cache miss, so request cost is effectively free.

### How `compute-tvl` builds the doc

The job is fully **isolated from the data warehouse**. Its only external
dependencies are the Wormhole accountant contract and CoinGecko.

```
       accountant                     CoinGecko
  (wormchain smart query)       (/coins/list, /coins/{id},
            |                      /simple/price)
            v                              ^
  +--------------------+      miss         |
  | all_accounts pages | ------> resolver -+
  +--------------------+                   |
            |                              v
            |                 +--------------------------+
            |                 | FIRESTORE_TVL_METADATA_  |
            |                 |      COLLECTION          |
            |                 | (one doc per token)      |
            |                 +--------------------------+
            |                              |
            v                              v
          balances                       prices
              \                          /
               v                        v
            +------ computeTVL ------+
                        |
                        v
         FIRESTORE_TVL_COLLECTION/tvl                    <-- served by /tvl
         FIRESTORE_LATEST_TOKEN_DATA_COLLECTION/latest   <-- served by /latest-tokendata
```

Per run:

1. **Pull accountant balances.** `all_accounts` is queried in 2000-item pages
   from the global accountant contract
   (`ACCOUNTANT_CONTRACT_ADDRESS`) against a fallback list of Wormchain RPCs.
   Each account is `{ chain_id, token_chain, token_address, balance }`.
2. **Load the token metadata cache** from
   `FIRESTORE_TVL_METADATA_COLLECTION`. Docs are keyed
   `{token_chain}_{token_address}` and carry
   `{ native_address, coin_gecko_coin_id, decimals, symbol, name, resolved, updatedAt }`.
3. **Resolve any uncached or stale tokens** (see below). New metadata is written
   back to the cache whether or not CoinGecko recognizes the token.
4. **Batch-fetch live prices** via `/simple/price` for the set of
   `coin_gecko_coin_id`s currently held.
5. **Aggregate** balances where `chain_id == token_chain` (TVL = tokens on
   their home chain), apply `isTokenDenylisted`, scale by
   `min(MAX_VAA_DECIMALS, decimals)`, and multiply by price.
6. **Write** the resulting `NotionalTVL` to
   `FIRESTORE_TVL_COLLECTION/tvl`, replacing the prior doc.
7. **Write** a denormalized `TokenData[]` doc (metadata + `price_usd` for every
   priced token in the accountant) to
   `FIRESTORE_LATEST_TOKEN_DATA_COLLECTION/latest`. This is what `/latest-tokendata`
   serves — the dashboard's `useTokenData` hook reads it to render the Accountant
   view's TVL/TVM aggregation. The price freshness of `/latest-tokendata` is
   therefore bounded by the `compute-tvl` cron cadence.

### Token resolution

For each unseen `(token_chain, token_address)` pair:

1. Convert `token_address` (Wormhole's 32-byte canonical form) to the native
   address format using
   `getNativeAddress` from `@wormhole-foundation/wormhole-monitor-database`.
   EVM and Solana are pure decode; Aptos / Sui / Near / Injective may hit a
   chain RPC the first time.
2. Look up the native address in CoinGecko's
   `/coins/list?include_platform=true` response under the chain's platform
   (`COINGECKO_PLATFORM_BY_CHAIN`). If no match, persist a negative entry
   (`resolved: false`) so we don't re-resolve every run.
3. Fetch `/coins/{id}` once to get `detail_platforms[platform].decimal_place`,
   symbol, and name. Persist the positive entry (`resolved: true`).

**Retry policy.** A negative entry is retried after 30 days
(`UNRESOLVED_RETRY_MS`) in case the token was listed since.

**Time budget.** Resolution stops at a 7-minute wall-clock budget inside the
function (`RESOLVE_DEADLINE_MS`) so we always publish a `NotionalTVL` doc,
even if a big chunk of new tokens couldn't be resolved this run. They'll be
picked up on subsequent runs.

**Rate limits.** Resolution issues one `/coins/{id}` call per new token.
CoinGecko pro is strongly recommended — on the free tier the first run
against an empty cache will run out of rate budget well before it resolves
the full accountant set. The function reads `COINGECKO_API_KEY` from env
(wired as a Secret Manager secret in `deploy.sh`) and passes it to
`fetchCoinDetail` / `fetchPrices` / `fetchCoins`.

### Required environment

| var                                      | purpose                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| `FIRESTORE_TVL_COLLECTION`               | collection holding the `tvl` output doc                        |
| `FIRESTORE_TVL_METADATA_COLLECTION`      | metadata cache, one doc per token                              |
| `FIRESTORE_LATEST_TOKEN_DATA_COLLECTION` | collection holding the denormalized `/latest-tokendata` doc    |
| `COINGECKO_API_KEY`                      | pro key for rate-limited resolution (optional but recommended) |

There are **no PG\_\* vars** anywhere in `cloud_functions/`. Postgres has been
fully removed; metadata and prices come from the Firestore cache +
CoinGecko.

### Seeding the cache

The cache is self-populating. The very first run against an empty
`FIRESTORE_TVL_METADATA_COLLECTION` will attempt to resolve every token in
the accountant, likely hitting the `RESOLVE_DEADLINE_MS` budget. Subsequent
runs pick up where the last one left off, so a few back-to-back invocations
will fully seed the cache. After that, steady-state each run resolves only
newly-registered tokens.
