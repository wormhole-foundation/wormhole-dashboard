import { BN } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SolanaJSONRPCError,
  VersionedBlockResponse,
  VersionedMessage,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { isLegacyMessage } from '@wormhole-foundation/wormhole-monitor-common';

export const findNextValidBlock = async (
  connection: Connection,
  slot: number,
  next: number,
  retries: number
): Promise<VersionedBlockResponse> => {
  // identify block range by fetching signatures of the first and last transactions
  // getSignaturesForAddress walks backwards so fromSignature occurs after toSignature
  if (retries === 0) throw new Error(`No block found after exhausting retries`);

  let block: VersionedBlockResponse | null = null;
  try {
    block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });
  } catch (e) {
    if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
      // failed to get confirmed block: slot was skipped or missing in long-term storage
      return findNextValidBlock(connection, slot + next, next, retries - 1);
    } else {
      throw e;
    }
  }

  if (!block || !block.blockTime || block.transactions.length === 0) {
    return findNextValidBlock(connection, slot + next, next, retries - 1);
  }

  return block;
};

// returns the signatures of the first and last transactions in the block range
// fromSignature is the first transaction of the last block
// toSignature is the last transaction of the first block
export const findFromSignatureAndToSignature = async (
  connection: Connection,
  fromSlot: number,
  toSlot: number,
  retries = 5
) => {
  let toBlock: VersionedBlockResponse;
  let fromBlock: VersionedBlockResponse;

  try {
    toBlock = await findNextValidBlock(connection, toSlot + 1, -1, retries);
    fromBlock = await findNextValidBlock(connection, fromSlot - 1, 1, retries);
  } catch (e) {
    throw new Error('solana: invalid block range: ' + (e as Error).message);
  }

  const fromSignature = toBlock.transactions[0].transaction.signatures[0];
  const toSignature =
    fromBlock.transactions[fromBlock.transactions.length - 1].transaction.signatures[0];

  return { fromSignature, toSignature, toBlock };
};

// copied from https://github.com/wormhole-foundation/example-native-token-transfers/blob/main/solana/ts/sdk/utils.ts#L38-L52
export const U64 = {
  MAX: new BN((2n ** 64n - 1n).toString()),
  to: (amount: number, unit: number) => {
    const ret = new BN(Math.round(amount * unit));

    if (ret.isNeg()) throw new Error('Value negative');

    if (ret.bitLength() > 64) throw new Error('Value too large');

    return ret;
  },
  from: (amount: BN, unit: number) => amount.toNumber() / unit,
};

export async function getAllKeys(
  connection: Connection,
  res: VersionedTransactionResponse
): Promise<PublicKey[]> {
  const message: VersionedMessage = res.transaction.message;
  let accountKeys = isLegacyMessage(message) ? message.accountKeys : message.staticAccountKeys;

  // If the message contains an address table lookup, we need to resolve the addresses
  // before looking for the programIdIndex
  if (message.addressTableLookups.length > 0) {
    const lookupPromises = message.addressTableLookups.map(async (atl) => {
      const lookupTableAccount = await connection
        .getAddressLookupTable(atl.accountKey)
        .then((res) => res.value);

      if (!lookupTableAccount)
        throw new Error('lookupTableAccount is null, cant resolve addresses');

      // Important to return the addresses in the order they're specified in the
      // address table lookup object. Note writable comes first, then readable.
      return [
        atl.accountKey,
        atl.writableIndexes.map((i) => lookupTableAccount.state.addresses[i]),
        atl.readonlyIndexes.map((i) => lookupTableAccount.state.addresses[i]),
      ] as [PublicKey, PublicKey[], PublicKey[]];
    });

    // Lookup all addresses in parallel
    const lookups = await Promise.all(lookupPromises);

    // Ensure the order is maintained for lookups
    // Static, Writable, Readable
    // ref: https://github.com/gagliardetto/solana-go/blob/main/message.go#L414-L464
    const writable: PublicKey[] = [];
    const readable: PublicKey[] = [];
    for (const atl of message.addressTableLookups) {
      const table = lookups.find((l) => l[0].equals(atl.accountKey));
      if (!table) throw new Error('Could not find address table lookup');
      writable.push(...table[1]);
      readable.push(...table[2]);
    }

    accountKeys.push(...writable.concat(readable));
  }
  return accountKeys;
}
