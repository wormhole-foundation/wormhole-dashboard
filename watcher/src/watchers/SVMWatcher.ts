import {
  Commitment,
  ConfirmedSignatureInfo,
  Connection,
  PublicKey,
  SolanaJSONRPCError,
  VersionedBlockResponse,
  VersionedMessage,
} from '@solana/web3.js';
import { decode } from 'bs58';
import { z } from 'zod';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import {
  Mode,
  normalizeCompileInstruction,
  universalAddress_stripped,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Watcher } from './Watcher';
import { Network, contracts, encoding } from '@wormhole-foundation/sdk-base';
import { deserializePostMessage } from '@wormhole-foundation/sdk-solana-core';
import { getAllKeys } from '../utils/solana';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { DeriveType, deserialize, Layout } from 'binary-layout';
import { SVMChain } from 'src/types/svm';

const COMMITMENT: Commitment = 'finalized';
const GET_SIGNATURES_LIMIT = 1000;

// TODO: when an SVM chain is added w/ different shim contracts, this will need to be updated
const ShimContracts: { [key in Network]: string } = {
  Mainnet: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
  Testnet: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
  Devnet: '',
};

const POST_MESSAGE_INSTRUCTION_ID = 0x01;
const shimMessageEventDiscriminator = 'e445a52e51cb9a1d441b8f004d4c8970';

const shimMessageEventLayout = [
  { name: 'discriminator', binary: 'bytes', size: 16 },
  { name: 'emitterAddress', binary: 'bytes', size: 32 },
  { name: 'sequence', binary: 'uint', size: 8, endianness: 'little' },
  { name: 'timestamp', binary: 'uint', size: 4, endianness: 'little' },
] as const satisfies Layout;
export type ShimMessageEvent = DeriveType<typeof shimMessageEventLayout>;

export class SVMWatcher extends Watcher {
  readonly rpc: string;
  readonly coreBridgeProgramId: string;
  readonly shimProgramId: string;
  // this is set as a class field so we can modify it in tests
  getSignaturesLimit = GET_SIGNATURES_LIMIT;
  // The Solana watcher uses the `getSignaturesForAddress` RPC endpoint to fetch all transactions
  // containing Wormhole messages. This API takes in signatures and paginates based on number of
  // transactions returned. Since we don't know the number of transactions in advance, we use
  // a block range of 100K slots. Technically, batch size can be arbitrarily large since pagination
  // of the WH transactions within that range is handled internally below.
  maximumBatchSize = 1_000;

  connection: Connection | undefined;

  constructor(network: Network, chain: SVMChain, mode: Mode = 'vaa', rpc?: string) {
    super(network, chain, mode);
    // only allow rpc to be set for 'Testnet' and mode 'vaa'
    // This allows the use of the explorer RPC for testnet testing.
    if (rpc && network !== 'Testnet') {
      throw new Error('RPC can only be set for Testnet');
    }
    if (rpc && mode !== 'vaa') {
      throw new Error('RPC can only be set for mode vaa');
    }
    if (rpc && network === 'Testnet') {
      this.rpc = rpc;
    } else {
      this.rpc = RPCS_BY_CHAIN[network][chain]!;
    }
    // TODO: remove `as any` assertion once fogo mainnet is deployed
    this.coreBridgeProgramId = contracts.coreBridge(this.network, this.chain as any);
    this.shimProgramId = ShimContracts[this.network];
  }

  getConnection(): Connection {
    this.connection = this.connection ?? new Connection(this.rpc, COMMITMENT);
    return this.connection;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    return this.getConnection().getSlot();
  }

  private async findNextValidBlock(
    slot: number,
    next: number,
    retries: number
  ): Promise<VersionedBlockResponse> {
    // identify block range by fetching signatures of the first and last transactions
    // getSignaturesForAddress walks backwards so fromSignature occurs after toSignature
    if (retries === 0) throw new Error(`No block found after exhausting retries`);

    let block: VersionedBlockResponse | null = null;
    try {
      block = await this.getConnection().getBlock(slot, { maxSupportedTransactionVersion: 0 });
    } catch (e) {
      if (e instanceof SolanaJSONRPCError && (e.code === -32007 || e.code === -32009)) {
        // failed to get confirmed block: slot was skipped or missing in long-term storage
        return this.findNextValidBlock(slot + next, next, retries - 1);
      } else {
        throw e;
      }
    }

    if (!block || !block.blockTime || block.transactions.length === 0) {
      return this.findNextValidBlock(slot + next, next, retries - 1);
    }

    return block;
  }

  async getMessagesForBlocks(
    fromSlot: number,
    toSlot: number
  ): Promise<{ vaasByBlock: VaasByBlock; optionalBlockHeight?: number }> {
    // in the rare case of maximumBatchSize skipped blocks in a row,
    // you might hit this error due to the recursion below
    if (fromSlot > toSlot) throw new Error('solana: invalid block range');
    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);

    //
    const vaasByBlock: VaasByBlock = {};

    // identify block range by fetching signatures of the first and last transactions
    // getSignaturesForAddress walks backwards so fromSignature occurs after toSignature

    // start by finding a valid range of blocks so we can use their
    // signatures in the `getSignaturesForAddress` search
    // look for the (last block + 1) and (first block - 1) since the signature parameters in the search later
    // are _exclusive_ so we have to get the signatures immediate preceeding or following the ones we're interested in
    const retries = 5;
    let toBlock: VersionedBlockResponse;
    let fromBlock: VersionedBlockResponse;

    try {
      toBlock = await this.findNextValidBlock(toSlot + 1, -1, retries);
      fromBlock = await this.findNextValidBlock(fromSlot - 1, 1, retries);
    } catch (e) {
      throw new Error('solana: invalid block range: ' + (e as Error).message);
    }

    const fromSignature = toBlock.transactions[0].transaction.signatures[0];
    const toSignature =
      fromBlock.transactions[fromBlock.transactions.length - 1].transaction.signatures[0];

    // get all core bridge signatures between fromTransaction and toTransaction
    let numSignatures = this.getSignaturesLimit;
    let currSignature: string | undefined = fromSignature;
    while (numSignatures === this.getSignaturesLimit) {
      const signatures: ConfirmedSignatureInfo[] =
        await this.getConnection().getSignaturesForAddress(
          new PublicKey(this.coreBridgeProgramId),
          {
            before: currSignature,
            until: toSignature,
            limit: this.getSignaturesLimit,
          }
        );

      this.logger.info(`processing ${signatures.length} transactions`);

      // In order to determine if a transaction has a Wormhole message, we normalize and iterate
      // through all instructions in the transaction. Only PostMessage instructions are relevant
      // when looking for messages. PostMessageUnreliable instructions are ignored because there
      // are no data availability guarantees (ie the associated message accounts may have been
      // reused, overwriting previous data). Then, the message account is the account given by
      // the second index in the instruction's account key indices. From here, we can fetch the
      // message data from the account and parse out the emitter and sequence.
      const results = await this.getConnection().getTransactions(
        signatures.map((s) => s.signature),
        {
          maxSupportedTransactionVersion: 0,
        }
      );

      if (results.length !== signatures.length) {
        throw new Error(`solana: failed to fetch tx for signatures`);
      }

      for (const res of results) {
        if (res?.meta?.err) {
          // skip errored txs
          continue;
        }
        if (!res || !res.blockTime) {
          throw new Error(
            `${this.chain}: failed to fetch tx for signature ${
              res?.transaction.signatures[0] || 'unknown'
            }`
          );
        }

        const accountKeys = await getAllKeys(this.getConnection(), res);
        const coreBridgeProgramIdIndex = accountKeys.findIndex(
          (i) => i.toBase58() === this.coreBridgeProgramId
        );
        const shimProgramIdIndex = accountKeys.findIndex(
          (i) => i.toBase58() === this.shimProgramId
        );
        const message: VersionedMessage = res.transaction.message;
        const outerInstructions = message.compiledInstructions;
        const innerInstructions =
          res.meta?.innerInstructions?.flatMap((i) =>
            i.instructions.map(normalizeCompileInstruction)
          ) || [];

        // Need to look for Wormhole instructions and shim instructions
        const allInstructions = innerInstructions
          .concat(outerInstructions)
          .filter(
            (i) =>
              i.programIdIndex === coreBridgeProgramIdIndex ||
              i.programIdIndex === shimProgramIdIndex
          );

        const blockKey = makeBlockKey(
          res.slot.toString(),
          new Date(res.blockTime * 1000).toISOString()
        );

        const vaaKeys: string[] = [];
        for (const instruction of allInstructions) {
          // The only instructions that get this far are either coreBridge or shim instructions
          const instructionId = instruction.data;

          let emitterAddress: UniversalAddress | undefined = undefined;
          let sequence: bigint | undefined = undefined;

          // We don't look for PostMessageUnreliable instructions since they aren't reobservable.
          if (
            instruction.programIdIndex === coreBridgeProgramIdIndex &&
            instructionId[0] === POST_MESSAGE_INSTRUCTION_ID
          ) {
            // Got post message instruction
            const accountId = accountKeys[instruction.accountKeyIndexes[1]];

            const acctInfo = await this.getConnection().getAccountInfo(accountId, COMMITMENT);
            if (!acctInfo?.data) throw new Error('No data found in message account');
            const deserializedMsg = deserializePostMessage(new Uint8Array(acctInfo.data));
            emitterAddress = deserializedMsg.emitterAddress;
            sequence = deserializedMsg.sequence;
          } else if (instruction.programIdIndex === shimProgramIdIndex) {
            // Got shim instruction
            const parsedMsg = this.parseShimMessage(instruction.data);
            if (!parsedMsg) {
              // Failed to parse shim message
              // This is not a fatal error, just skip it.
              continue;
            }
            emitterAddress = parsedMsg.emitterAddress;
            sequence = parsedMsg.sequence;
          } else {
            // Not a coreBridge post message or shim instruction
            continue;
          }

          if (emitterAddress !== undefined && sequence !== undefined) {
            vaaKeys.push(
              makeVaaKey(
                res.transaction.signatures[0], // This is the tx hash
                this.chain,
                universalAddress_stripped(emitterAddress),
                sequence.toString()
              )
            );
          }
        }
        if (vaaKeys.length > 0)
          vaasByBlock[blockKey] = [...vaaKeys, ...(vaasByBlock[blockKey] || [])];
      }

      numSignatures = signatures.length;
      currSignature = signatures.at(-1)?.signature;
    }

    // add last block for storeVaasByBlock
    const lastBlockKey = makeBlockKey(
      toSlot.toString(),
      new Date(toBlock.blockTime! * 1000).toISOString()
    );
    return { vaasByBlock: { [lastBlockKey]: [], ...vaasByBlock } };
  }

  parseShimMessage(data: Uint8Array): {
    emitterAddress: UniversalAddress;
    sequence: bigint;
  } | null {
    // First step is to convert the data into a hex string
    const hexData = encoding.hex.encode(data);

    // Next, we need to look for the discriminator that we care about.
    if (hexData.startsWith(shimMessageEventDiscriminator)) {
      // Use the binary layout to deserialize the data
      const decoded = deserialize(shimMessageEventLayout, data);
      const emitterAddress = new UniversalAddress(decoded.emitterAddress);
      const sequence = decoded.sequence;

      return { emitterAddress, sequence };
    }
    return null;
  }

  isValidVaaKey(key: string) {
    try {
      const [txHash, vaaKey] = key.split(':');
      const txHashDecoded = Buffer.from(decode(txHash)).toString('hex');
      const [_, emitter, sequence] = vaaKey.split('/');
      return !!(
        /^[0-9a-fA-F]{128}$/.test(z.string().parse(txHashDecoded)) &&
        /^[0-9a-fA-F]{64}$/.test(z.string().parse(emitter)) &&
        z.number().int().parse(Number(sequence)) >= 0
      );
    } catch (e) {
      return false;
    }
  }
}
