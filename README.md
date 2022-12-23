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
2. google firestore: set DB_SOURCE="firestore" and set FIRESTORE_ACCOUNT_KEY=/path/of/service/account/key.json
   In addition, set FIRESTORE_COLLECTION to name of your table where you intend to store the data.
3. google bigtable with firestore:
   > you will need to set up your credentials: https://cloud.google.com/docs/authentication/provide-credentials-adc and set GOOGLE_APPLICATION_CREDENTIALS to the path of your credentials
   > set up the instance and table: https://cloud.google.com/bigtable/docs/creating-instance
   > set DB_SOURCE="bigtable", BIGTABLE_INSTANCE_ID, and BIGTABLE_TABLE_ID
   > The current implementation of bigtable uses firestore to read/write the latest processed blocks by chain (incl empty blocks). Set FIRESTORE_LATEST_COLLECTION to the firestore table that will store these values

# Server

Express server that serves up the db file. Eventually there should be, like, a real db and stuff.

## Run

```bash
npm run dev -w server
```

# Web

Displays a visualization of the database.

## Run

```bash
npm start -w web
```
