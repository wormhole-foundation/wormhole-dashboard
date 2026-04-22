export const FIRESTORE_BATCH_LIMIT = 500;

export const toFirestoreDocId = (key: string): string => key.replaceAll('/', '~');

export const fromFirestoreDocId = (docId: string): string => docId.replaceAll('~', '/');
