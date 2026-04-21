# cloud_functions

Google Cloud Functions backing the dashboard and downstream consumers.

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
   # optional (pro CoinGecko key; recommended for first-run cache seed):
   # COINGECKO_API_KEY=<pro key>
   GOOGLE_APPLICATION_CREDENTIALS=../serviceAccount.json
   GOOGLE_CLOUD_PROJECT=wormhole-message-db-mainnet
   ```

   Use `-dev`-suffixed Firestore collections so local runs don't overwrite the
   prod `tvl` doc or prod metadata cache. Firestore creates collections
   lazily on first write.

3. **Start the framework.**

   ```bash
   npx functions-framework --target=computeTVL --signature-type=http
   ```

   Listens on `:8080`.

4. **Invoke.**

   ```bash
   curl -v http://localhost:8080
   ```

   Watch the logs for the accountant pagination count, cache load, resolver
   progress, and `Computed TVL: $...`. Re-running should print
   `Need to resolve 0 tokens` once the cache is seeded.

5. **Inspect output.** Either read `tvl-dev/tvl` in the Firestore console, or
   run `getTVL` locally in a second shell:

   ```bash
   # .env for this shell:
   # FUNCTION=getTVL
   # FIRESTORE_TVL_COLLECTION=tvl-dev
   npx functions-framework --target=getTVL --signature-type=http --port=8081
   curl http://localhost:8081 | jq '.AllTime."*"'
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
         FIRESTORE_TVL_COLLECTION/tvl   <-- served by /tvl
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

| var | purpose |
| --- | --- |
| `FIRESTORE_TVL_COLLECTION` | collection holding the `tvl` output doc |
| `FIRESTORE_TVL_METADATA_COLLECTION` | metadata cache, one doc per token |
| `COINGECKO_API_KEY` | pro key for rate-limited resolution (optional but recommended) |

There are **no PG_* vars.** The prior SQL-aggregate version has been
replaced.

### Seeding the cache

The cache is self-populating. The very first run against an empty
`FIRESTORE_TVL_METADATA_COLLECTION` will attempt to resolve every token in
the accountant, likely hitting the `RESOLVE_DEADLINE_MS` budget. Subsequent
runs pick up where the last one left off, so a few back-to-back invocations
will fully seed the cache. After that, steady-state each run resolves only
newly-registered tokens.

### Related TVL/TVM functions

- `compute-tvl-tvm` / `latest-tvltvm` — per-chain TVL **and** TVM (tokens
  locked on non-home chains), also accountant-sourced but writes a separate
  Firestore collection.
- `compute-tvl-history` / `tvl-history` — daily historical TVL, still sourced
  from Postgres token-transfer aggregates.
