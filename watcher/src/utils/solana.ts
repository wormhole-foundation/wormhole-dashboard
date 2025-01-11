import { BN } from '@coral-xyz/anchor';
import { Connection, SolanaJSONRPCError, VersionedBlockResponse } from '@solana/web3.js';

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
  retries = 10 // 5 is too low, watcher gets stuck and throws error 
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
