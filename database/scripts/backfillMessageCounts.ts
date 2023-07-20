import * as dotenv from 'dotenv';
import axios from 'axios';
import { Firestore } from 'firebase-admin/firestore';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { CHAIN_ID_PYTHNET } from '@certusone/wormhole-sdk';
dotenv.config();

export interface Totals {
  TotalCount: { [chainId: string]: number };
  DailyTotals: {
    // "2021-08-22": { "*": 0 },
    [date: string]: { [groupByKey: string]: number };
  };
}

(async () => {
  const messageCounts = (
    await axios.get<Totals>(
      'https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-transactiontotals',
    )
  ).data;
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION'),
  );
  for (const [date, msgs] of Object.entries(messageCounts.DailyTotals)) {
    // if (date !== '2023-07-10') continue;
    if (msgs['26']) await collection.doc(date).set({ '26': msgs['26'] }, { merge: true });
  }
})();
