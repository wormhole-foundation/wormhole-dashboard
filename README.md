# Wormhole Monitor

The goal of this repo is to detect misses by the Wormhole network and provide a visualization of Wormhole messages and misses.

The approach of this code is to crawl for Wormhole transactions on-chain and query if the corresponding VAA is available. This differs fundamentally from wormhole-explorer, in that the explorer provides what _did_ happen in the network, while this code can capture what _didn't_.

1. Detection - discover messages from the source chain, check if they have VAAs
1. Alerting - send alerts when VAAs are missing for some period of time
1. Recovery - automatically request that a guardian trigger re-observation on the missed VAA, developing an SLA

# Prerequisite

> Note: this repo uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)

```bash
npm ci
```

# Watcher

Watches each blockchain for new logs. Will need to expand to all chains and also check if the VAA is available.

## Design

### EVM

Compare the most recent "finalized" block to the most recent fetched block (or the block that the wormhole contract was deployed) and fetches, at most, the 100 earliest blocks (for timestamps) and logs (for messages). A benefit of this approach is that it should be flexible enough for all finality types and it provides for automatic backfilling and outage recovery.

## Run

You'll need a `.env` with an infura URL, or something that supports "finalized" block calls on Eth.

```bash
npm run dev -w watcher
```

# Database

Currently three options to load and save data:

1. local .json file: set env variable DB_SOURCE="local" (default) and optionally set JSON_DB_FILE path
2. google firestore (primary): set DB_SOURCE="firestore" and set FIRESTORE_ACCOUNT_KEY=/path/of/service/account/key.json
   In addition, set FIRESTORE_COLLECTION to name of your table where you intend to store the data, plus
   FIRESTORE_LATEST_COLLECTION for the per-chain last-processed-block pointer, and
   FIRESTORE_MISSING_VAAS_COLLECTION / FIRESTORE_SIGNED_VAAS_COLLECTION for the miss tracking and VAA archive.
3. google bigtable (rollback only): kept during the Firestore migration's stabilization window so we can flip
   `DB_SOURCE="bigtable"` if the Firestore path misbehaves. For that fallback you'll need:

   > credentials: https://cloud.google.com/docs/authentication/provide-credentials-adc (set GOOGLE_APPLICATION_CREDENTIALS)
   > instance + table: https://cloud.google.com/bigtable/docs/creating-instance > `DB_SOURCE="bigtable"`, `BIGTABLE_INSTANCE_ID`, `BIGTABLE_TABLE_ID`, `BIGTABLE_SIGNED_VAAS_TABLE_ID`, `BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID`
   > The bigtable path also uses firestore for per-chain last-processed-block pointers; set `FIRESTORE_LATEST_COLLECTION`.

   After the migration stabilizes (see `plans/firestore_migration.md` Phase 9), this option goes away along with
   the `BigtableDatabase.ts` implementation, the `@google-cloud/bigtable` dependency, and the BigTable instance itself.

## Firestore Indexes

The first time the Firestore database is set up, remember to create the composite indexes for signedVAAs

```bash
gcloud firestore --project "<PROJECT>" indexes composite create --collection-group=signedVAAs --query-scope=COLLECTION --field-config=field-path=chainId,order=ascending --field-config=field-path=day,order=ascending
gcloud firestore --project "<PROJECT>" indexes composite create --collection-group=signedVAAs --query-scope=COLLECTION --field-config=field-path=chainEmitter,order=ascending --field-config=field-path=day,order=ascending
```

# Web

Displays a visualization of the database.

## Run

```bash
npm start -w web
```

# Cloud Functions

## Development

### TypeScript

`./cloud_functions` stores the TypeScript Google Cloud Functions.

To add a new function:

1. Create a new file under `./cloud_functions/src`.
   > CRON jobs are generally prefixed with `compute`
2. Register new function in `./cloud_functions/src/index.ts`

   ```ts
   export const { newFunction } = require('./newFunction');

   functions.http('newFunction', newFunction);
   ```

To run it locally:

1. Make sure to authenticate your GCP account.
2. Update the `start` script in `./cloud_functions/package.json`
   ```json
   {
     "scripts": {
       "...": "...",
       "start": "npx functions-framework --target=newFunction [--signature-type=http]"
     }
   }
   ```
3. To run the function locally, run in `./cloud_functions`:

   ```
   npm run start
   ```
