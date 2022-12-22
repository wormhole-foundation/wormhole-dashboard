export const DB_SOURCE = process.env.DB_SOURCE || 'local';
export const DB_FILE = process.env.DB_FILE || '../server/db.json';
export const DB_LAST_BLOCK_FILE =
  process.env.DB_LAST_BLOCK_FILE || '../server/lastBlockByChain.json';
export const FIRESTORE_ACCOUNT_KEY_PATH = process.env.FIRESTORE_ACCOUNT_KEY_PATH || '';
export const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || '';
