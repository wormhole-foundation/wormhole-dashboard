# Wormhole Monitor

# Watcher

Watches each blockchain for new logs. Will need to expand to all chains and also check if the VAA is available.

You'll need a `.env` with an infura URL, or something that supports "finalized" block calls on Eth

```bash
cd watcher
npm ci
npm run dev
```

# Server

Express server that serves up the db file. Eventually there should be, like, a real db and stuff.

```bash
cd server
npm ci
node app.js
```

# Web

Displays a visualization of the database.

```bash
cd web
npm ci
npm start
```
