# Wormhole Monitor

The goal of this repo is to detect misses by the Wormhole network and provide a visualization of Wormhole messages and misses.

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

There is also a `start.sh` script to auto-restart on crashes.

# Server

Express server that serves up the db file. Eventually there should be, like, a real db and stuff.

## Run

```bash
cd server
npm ci
node app.js
```

# Web

Displays a visualization of the database.

## Run

```bash
cd web
npm ci
npm start
```
