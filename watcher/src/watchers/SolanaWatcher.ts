import { getPostedMessage } from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole';
import { CONTRACTS } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { RPCS_BY_CHAIN } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';
import { Watcher } from './Watcher';

const WORMHOLE_PROGRAM_ID = CONTRACTS.MAINNET.solana.core;
const COMMITMENT: Commitment = 'finalized';
const GET_SIGNATURES_LIMIT = 1000;

export class SolanaWatcher extends Watcher {
  connection: Connection;

  constructor() {
    super('solana');
    this.connection = new Connection(RPCS_BY_CHAIN.solana!, COMMITMENT);

    // can be arbitrarily large since getMessagesForBlocks handles pagination internally
    this.maximumBatchSize = 100000;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    return this.connection.getSlot();
  }

  async getMessagesForBlocks(fromSlot: number, toSlot: number): Promise<VaasByBlock> {
    if (fromSlot > toSlot) throw new Error('solana: invalid block range');
    this.logger.info(`fetching info for blocks ${fromSlot} to ${toSlot}`);
    const vaasByBlock: VaasByBlock = {};

    // get transaction bounds, fromTransaction occurs after toTransaction because getConfirmedSignaturesForAddress2 walks backwards
    const [fromBlock, toBlock] = await Promise.all([
      this.connection.getBlock(fromSlot, { maxSupportedTransactionVersion: 0 }),
      this.connection.getBlock(toSlot, { maxSupportedTransactionVersion: 0 }),
    ]);
    if (!fromBlock || !fromBlock.blockTime) return this.getMessagesForBlocks(fromSlot + 1, toSlot); // could be skipped slot
    if (!toBlock || !toBlock.blockTime) throw new Error(`solana: failed to fetch block ${toSlot}`); // this is finalized, has to exist
    const fromSignature = toBlock.transactions.at(-1)?.transaction.signatures[0];
    const toSignature = fromBlock.transactions[0].transaction.signatures[0];

    // get all core bridge signatures between fromTransaction and toTransaction
    let numSignatures = GET_SIGNATURES_LIMIT;
    let currSignature = fromSignature;
    while (numSignatures === GET_SIGNATURES_LIMIT) {
      // TODO(aki): do we need to slice the first result after the first call?
      const signatures = await this.connection.getConfirmedSignaturesForAddress2(
        new PublicKey(WORMHOLE_PROGRAM_ID),
        {
          before: currSignature,
          until: toSignature,
          limit: GET_SIGNATURES_LIMIT,
        }
      );
      for (const { signature } of signatures) {
        const res = await this.connection.getTransaction(signature);
        if (!res || !res.blockTime) {
          throw new Error(`solana: failed to fetch tx for signature ${signature}`);
        }

        const { accountKeys, instructions } = res.transaction.message;
        const programIdIndex = accountKeys.findIndex((i) => i.toBase58() === WORMHOLE_PROGRAM_ID);
        const innerInstructions = res.meta?.innerInstructions?.flatMap((i) => i.instructions) || [];
        const whInstructions = innerInstructions
          .concat(instructions)
          .filter((i) => i.programIdIndex === programIdIndex);
        for (const instruction of whInstructions) {
          const accountId = accountKeys[instruction.accounts[1]];
          const {
            message: { emitterAddress, sequence },
          } = await getPostedMessage(this.connection, accountId.toBase58(), COMMITMENT);
          const blockKey = makeBlockKey(res.slot.toString(), res.blockTime.toString());
          const vaaKey = makeVaaKey(
            signature,
            this.chain,
            emitterAddress.toString('hex'),
            sequence.toString()
          );
          vaasByBlock[blockKey] = [...(vaasByBlock[blockKey] || []), vaaKey];
        }
      }

      numSignatures = signatures.length;
      currSignature = signatures.at(-1)?.signature;
    }

    // add last block for storeVaasByBlock
    const lastBlockKey = makeBlockKey(toSlot.toString(), toBlock.blockTime.toString());
    return Object.assign({ [lastBlockKey]: [] }, vaasByBlock);
  }
}
