# Wormhole Monitor

The goal of this repo is to detect misses by the Wormhole network and provide a visualization of Wormhole messages and misses.

The approach of this code is to crawl for Wormhole transactions on-chain and query if the corresponding VAA is available. This differs fundamentally from wormhole-explorer, in that the explorer provides what _did_ happen in the network, while this code can capture what _didn't_.

1. Detection - discover messages from the source chain, check if they have VAAs
1. Alerting - send alerts when VAAs are missing for some period of time
1. Recovery - automatically request that a guardian trigger re-observation on the missed VAA, developing an SLA

# Caveats

- Currently dumps to a flat file in the server directory.
- The entire process dies if one of the ethers calls fails, because that's how ethers do.

# Watcher

Watches each blockchain for new logs. Will need to expand to all chains and also check if the VAA is available.

## Design

### EVM

Compare the most recent "finalized" block to the most recent fetched block (or the block that the wormhole contract was deployed) and fetches, at most, the 100 earliest blocks (for timestamps) and logs (for messages). A benefit of this approach is that it should be flexible enough for all finality types and it provides for automatic backfilling and outage recovery.

## Run

You'll need a `.env` with an infura URL, or something that supports "finalized" block calls on Eth.

```bash
cd watcher
npm ci
npm run dev
```

# Database

Currently two options to load data:

1. local .json file: set env variable DB_SOURCE="local" (default) and optionally set DB_FILE path
2. google firestore: set DB_SOURCE="firestore" and set FIRESTORE_ACCOUNT_KEY=/path/of/service/account/key.json
   In addition, set FIRESTORE_COLLECTION to name of your table where you intend to store the data.

# Server

Express server that serves up the db file. Eventually there should be, like, a real db and stuff.

## Run

```bash
cd server
npm ci
npm run dev
```

# Web

Displays a visualization of the database.

## Run

```bash
cd web
npm ci
npm start
```
