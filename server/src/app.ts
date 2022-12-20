import express from 'express';
import fs from 'fs';

const app = express();
const port = 4000;

const DB_FILE = './db.json';
const ENCODING = 'utf8';

app.get('/api/db', (req, res) => {
  res.send(fs.readFileSync(DB_FILE, ENCODING));
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
