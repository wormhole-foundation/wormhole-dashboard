import {
  Connection,
  ConfirmedSignatureInfo,
  PublicKey,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  ParsedTransactionWithMeta,
  SolanaJSONRPCError,
  VersionedBlockResponse,
} from '@solana/web3.js';
import * as ethers from 'ethers';
import * as bs58 from 'bs58';
import { deserialize } from 'borsh';
import { assertEnvironmentVariable, EventData } from '@wormhole-foundation/wormhole-monitor-common';

export async function getSolanaEvents(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  if (!req.query.fromSlot) {
    res.status(400).send('fromSlot is required');
    return;
  }
  if (!req.query.toSlot) {
    res.status(400).send('toSlot is required');
    return;
  }
  try {
    const fromSlot = Number(req.query.fromSlot);
    const toSlot = Number(req.query.toSlot);
    console.log(`fetching events from ${fromSlot} to ${toSlot}`);
    // the RPC doesn't store blocks that are too old
    const events = fromSlot < 232090284 ? [] : await _getSolanaEvents(fromSlot, toSlot);
    console.log(`fetched ${events.length} events`);
    res.json(events);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
}

const coreBridge = new PublicKey('worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth');
const tokenBridge = new PublicKey('wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb');
const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const mintAuthority = 'BCD75RNBHrJJpW4dXVagL5mPjzRLnVZq4YirJdjEYMV7';
const transferAuthority = '7oPa2PHQdZmjSPqvpZN7MQxnC7Dcf3uL4oLqknGLk2S3';
const custodyAuthority = 'GugU1tP7doLeTw9hQP51xRJyS8Da1fWxuiy2rVrnMD2m';

enum CoreBridgeIxId {
  PostMessage = 0x1,
}

enum TokenBridgeIxId {
  CompleteNative = 0x2,
  CompleteWrapped,
  TransferWrapped,
  TransferNative,
  CompleteNativeWithPayload = 0x9,
  CompleteWrappedWithPayload,
  TransferWrappedWithPayload,
  TransferNativeWithPayload,
}

const PostMessageDataSchema = {
  struct: {
    nonce: 'u32',
    payload: { array: { type: 'u8' } },
    consistency_level: 'u8',
  },
};

/**
 * Retrieves Solana events from a given slot range using the token bridge.
 * @param fromSlot The starting slot to retrieve events from.
 * @param toSlot The ending slot to retrieve events from.
 * @returns An array of EventData objects representing the events that occurred within the given slot range.
 */
const _getSolanaEvents = async (fromSlot: number, toSlot: number) => {
  const txs = await getParsedTransactions(fromSlot, toSlot, tokenBridge);
  const events = txs.reduce((acc, tx) => {
    if (!tx || !tx.blockTime || tx.meta?.err) {
      return acc;
    }
    // handle the case where the token bridge instruction is a top-level instruction
    tx.transaction.message.instructions.forEach((ix: any, index: any) => {
      if (!isTokenBridgeIx(ix)) {
        return;
      }
      const innerIx = tx.meta?.innerInstructions?.find((innerIx: any) => innerIx.index === index);
      if (!innerIx || innerIx.instructions.length === 0) {
        return;
      }
      const event = getEventData(tx, ix, innerIx.instructions);
      if (event) {
        acc.push(event);
      }
    });
    // handle the case where the token bridge instruction is an inner instruction
    tx.meta?.innerInstructions?.forEach((innerIx: any) => {
      innerIx.instructions.forEach((ix: any, index: any) => {
        if (isTokenBridgeIx(ix)) {
          const event = getEventData(tx, ix, innerIx.instructions.slice(index + 1));
          if (event) {
            acc.push(event);
          }
        }
      });
    });
    return acc;
  }, [] as EventData[]);
  return events;
};

const getEventData = (
  tx: ParsedTransactionWithMeta,
  tokenBridgeIx: PartiallyDecodedInstruction,
  innerIxs: (ParsedInstruction | PartiallyDecodedInstruction)[]
): EventData | undefined => {
  const data = bs58.decode(tokenBridgeIx.data);
  if (data.length === 0) {
    return;
  }
  const tokenBridgeIxId = data[0];
  const txHash = tx.transaction.signatures[0];
  const blockNumber = tx.slot;
  // search the inner instructions for token transfer instructions to get the event data
  switch (tokenBridgeIxId) {
    case TokenBridgeIxId.TransferNative:
    case TokenBridgeIxId.TransferNativeWithPayload: {
      const transferIx = innerIxs.find(
        (ix): ix is ParsedInstruction =>
          isTransferIx(ix) && ix.parsed.info?.authority === transferAuthority
      );
      if (transferIx) {
        return {
          blockNumber,
          txHash,
          to: transferIx.parsed.info?.destination,
          from: transferIx.parsed.info?.source,
          token: tokenBridgeIx.accounts[3]?.toString() || '', // mint account
          amount: transferIx.parsed.info?.amount,
          isDeposit: true,
        };
      }
      break;
    }
    case TokenBridgeIxId.TransferWrapped:
    case TokenBridgeIxId.TransferWrappedWithPayload: {
      const burnIx = innerIxs.find(
        (ix): ix is ParsedInstruction =>
          isBurnIx(ix) && ix.parsed.info?.authority === transferAuthority
      );
      const coreBridgeIx = innerIxs.find(
        (ix): ix is PartiallyDecodedInstruction =>
          ix.programId.equals(coreBridge) && (ix as PartiallyDecodedInstruction).data !== undefined
      );
      const coreBridgeIxData = coreBridgeIx?.data
        ? Buffer.from(bs58.decode(coreBridgeIx.data))
        : undefined;
      if (
        burnIx &&
        coreBridgeIxData &&
        coreBridgeIxData.length > 0 &&
        coreBridgeIxData[0] === CoreBridgeIxId.PostMessage
      ) {
        const postMessageData: any = deserialize(
          PostMessageDataSchema,
          coreBridgeIxData.subarray(1)
        );
        const payload = Buffer.from(postMessageData.payload);
        const originChain = payload.readUint16BE(65);
        const toChain = payload.readUInt16BE(99);
        // if this is a wrapped token being burned and not being sent to its origin chain,
        // then it should be included in the volume by fixing the `to` address
        // https://docs.wormhole.com/wormhole/explore-wormhole/vaa#token-transfer
        const to = toChain !== originChain ? tokenBridge.toString() : ethers.ZeroAddress;
        return {
          blockNumber,
          txHash,
          to,
          from: burnIx.parsed.info?.account,
          token: tokenBridgeIx.accounts[4]?.toString() || '', // mint account
          amount: burnIx.parsed.info?.amount,
          isDeposit: false,
        };
      }
      break;
    }
    case TokenBridgeIxId.CompleteNative:
    case TokenBridgeIxId.CompleteNativeWithPayload: {
      // TODO: this doesn't handle the case where the fee recipient is not the destination
      // in this case there will be another transfer instruction with the fee recipient as the destination
      const transferIx = innerIxs.find(
        (ix): ix is ParsedInstruction =>
          isTransferIx(ix) &&
          ix.parsed.info?.authority === custodyAuthority &&
          (tokenBridgeIxId === TokenBridgeIxId.CompleteNativeWithPayload ||
            ix.parsed.info?.destination === tokenBridgeIx.accounts[6].toString())
      );
      if (transferIx) {
        const mintAccountIndex = tokenBridgeIxId === TokenBridgeIxId.CompleteNative ? 8 : 9;
        return {
          blockNumber,
          txHash,
          to: transferIx.parsed.info?.destination,
          from: transferIx.parsed.info?.source,
          token: tokenBridgeIx.accounts[mintAccountIndex]?.toString() || '', // mint account
          amount: transferIx.parsed.info?.amount,
          isDeposit: false,
        };
      }
      break;
    }
    case TokenBridgeIxId.CompleteWrapped:
    case TokenBridgeIxId.CompleteWrappedWithPayload: {
      // TODO: this doesn't handle the case where the fee recipient is not the destination
      // in this case there will be another mint instruction with the fee recipient as the destination
      const mintToIx = innerIxs.find(
        (ix): ix is ParsedInstruction =>
          isMintToIx(ix) &&
          ix.parsed.info?.mintAuthority === mintAuthority &&
          (tokenBridgeIxId === TokenBridgeIxId.CompleteWrappedWithPayload ||
            ix.parsed.info?.account === tokenBridgeIx.accounts[6].toString())
      );
      if (mintToIx) {
        return {
          blockNumber,
          txHash,
          to: mintToIx.parsed.info?.account,
          // to be consistent with the ethereum adapter,
          // we set the `from` address to the zero address for minted tokens
          from: ethers.ZeroAddress,
          token: mintToIx.parsed.info?.mint,
          amount: mintToIx.parsed.info?.amount,
          isDeposit: false,
        };
      }
      break;
    }
  }
};

const isTokenBridgeIx = (
  ix: ParsedInstruction | PartiallyDecodedInstruction
): ix is PartiallyDecodedInstruction =>
  ix.programId.equals(tokenBridge) && (ix as PartiallyDecodedInstruction).accounts !== undefined;

const isMintToIx = (ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction =>
  isTxOfType(ix, tokenProgram, 'mintTo');

const isBurnIx = (ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction =>
  isTxOfType(ix, tokenProgram, 'burn');

const isTransferIx = (
  ix: ParsedInstruction | PartiallyDecodedInstruction
): ix is ParsedInstruction => isTxOfType(ix, tokenProgram, 'transfer');

const isTxOfType = (
  ix: ParsedInstruction | PartiallyDecodedInstruction,
  programId: PublicKey,
  type: string
) => (ix as ParsedInstruction).parsed?.type === type && ix.programId.equals(programId);

/**
 * Fetches and returns an array of parsed transactions for a given address within a specified block range.
 * @param fromSlot The starting block slot.
 * @param toSlot The ending block slot.
 * @param address The public key of the address to fetch transactions for.
 * @returns An array of parsed transactions within the specified block range.
 * @throws An error if the block range is invalid or too large, or if a transaction cannot be fetched.
 */
async function getParsedTransactions(
  fromSlot: number,
  toSlot: number,
  address: PublicKey
): Promise<(ParsedTransactionWithMeta | null)[]> {
  const connection = new Connection(assertEnvironmentVariable('SOLANA_RPC'));
  if (fromSlot > toSlot) throw new Error('invalid block range');
  if (toSlot - fromSlot > 100_000) throw new Error('block range too large');

  // identify block range by fetching signatures of the first and last transactions
  // getSignaturesForAddress walks backwards so fromSignature occurs after toSignature
  let toBlock: VersionedBlockResponse | null = null;
  try {
    toBlock = await connection.getBlock(toSlot, {
      maxSupportedTransactionVersion: 0,
    });
  } catch (e) {
    if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
      // failed to get confirmed block: slot was skipped or missing in long-term storage
      return getParsedTransactions(fromSlot, toSlot - 1, address);
    } else {
      throw e;
    }
  }
  if (!toBlock || !toBlock.blockTime || toBlock.transactions.length === 0) {
    return getParsedTransactions(fromSlot, toSlot - 1, address);
  }
  const fromSignature =
    toBlock.transactions[toBlock.transactions.length - 1].transaction.signatures[0];

  let fromBlock: VersionedBlockResponse | null = null;
  try {
    fromBlock = await connection.getBlock(fromSlot, {
      maxSupportedTransactionVersion: 0,
    });
  } catch (e) {
    if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
      // failed to get confirmed block: slot was skipped or missing in long-term storage
      return getParsedTransactions(fromSlot + 1, toSlot, address);
    } else {
      throw e;
    }
  }
  if (!fromBlock || !fromBlock.blockTime || fromBlock.transactions.length === 0) {
    return getParsedTransactions(fromSlot + 1, toSlot, address);
  }
  const toSignature = fromBlock.transactions[0].transaction.signatures[0];

  // get all `address` signatures between fromTransaction and toTransaction
  const results = [];
  let numSignatures = 0;
  let currSignature: string | undefined = fromSignature;
  const limit = 100;
  do {
    const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(address, {
      before: currSignature,
      until: toSignature,
      limit,
    });
    const txs = await connection.getParsedTransactions(
      signatures.map((s) => s.signature),
      {
        maxSupportedTransactionVersion: 0,
      }
    );
    if (txs.length !== signatures.length) {
      throw new Error(`failed to fetch tx for signatures`);
    }
    results.push(...txs);
    numSignatures = signatures.length;
    currSignature = signatures[signatures.length - 1].signature;
  } while (numSignatures === limit);

  return results;
}
