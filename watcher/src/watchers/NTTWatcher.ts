import { ethers_contracts } from '@wormhole-foundation/sdk-evm-core';
import { Log } from '@ethersproject/abstract-provider';
import {
  Chain,
  Network,
  PlatformToChains,
  chainToChainId,
  contracts,
} from '@wormhole-foundation/sdk-base';
import {
  assertEnvironmentVariable,
  NTTChain,
  NTTEvmChain,
} from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { BigNumber } from 'ethers';
import knex, { Knex } from 'knex';
import {
  InboundTransferQueuedTopic,
  LifeCycle,
  NTT_DECIMALS,
  NTT_LIFECYCLE_TOPICS,
  OutboundTransferQueuedTopic,
  OutboundTransferRateLimitedTopic,
  TransferRedeemedTopic,
  TransferSentTopic,
  createNewLifeCycle,
  getNttManagerMessageDigest,
} from '../NTTConsts';
import { NTT_MANAGER_CONTRACT_ARRAY } from '@wormhole-foundation/wormhole-monitor-common';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { extractBlockFromKey, makeBlockKey } from '../databases/utils';
import { WormholeLogger } from '../utils/logger';
import { formatIntoTimestamp } from '../utils/timestamp';
import { NativeTokenTransfer, NttManagerMessage, WormholeTransceiverMessage } from './NTTPayloads';
import { Watcher } from './Watcher';
import { parseWormholeLog } from './NTTUtils';

export const LOG_MESSAGE_PUBLISHED_TOPIC =
  '0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2';
export const wormholeInterface = ethers_contracts.Implementation__factory.createInterface();

export type BlockTag = 'finalized' | 'safe' | 'latest';
export type Block = {
  hash: string;
  number: number;
  timestamp: number;
};
export type ErrorBlock = {
  code: number; //6969,
  message: string; //'Error: No response received from RPC endpoint in 60s'
};

export class NTTWatcher extends Watcher {
  chain: NTTChain;
  finalizedBlockTag: BlockTag;
  lastTimestamp: number;
  latestFinalizedBlockNumber: number;
  pg: Knex;

  constructor(network: Network, chain: NTTEvmChain, finalizedBlockTag: BlockTag = 'latest') {
    super(network, chain, 'ntt');
    this.chain = chain;
    this.lastTimestamp = 0;
    this.latestFinalizedBlockNumber = 0;
    this.finalizedBlockTag = finalizedBlockTag;
    this.pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_NTT_USER'),
        password: assertEnvironmentVariable('PG_NTT_PASSWORD'),
        database: assertEnvironmentVariable('PG_NTT_DATABASE'),
        host: assertEnvironmentVariable('PG_NTT_HOST'),
        port: Number(assertEnvironmentVariable('PG_NTT_PORT')),
      },
    });
    this.logger.debug('NTTWatcher', network, chain, finalizedBlockTag);
  }

  async getBlock(blockNumberOrTag: number | BlockTag): Promise<Block> {
    const rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    let result = (
      await axios.post(
        rpc,
        [
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByNumber',
            params: [
              typeof blockNumberOrTag === 'number'
                ? `0x${blockNumberOrTag.toString(16)}`
                : blockNumberOrTag,
              false,
            ],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data?.[0];
    if (result && result.result === null) {
      // Found null block
      if (
        typeof blockNumberOrTag === 'number' &&
        blockNumberOrTag < this.latestFinalizedBlockNumber - 1000
      ) {
        return {
          hash: '',
          number: BigNumber.from(blockNumberOrTag).toNumber(),
          timestamp: BigNumber.from(this.lastTimestamp).toNumber(),
        };
      }
    } else if (result && result.error && result.error.code === 6969) {
      return {
        hash: '',
        number: BigNumber.from(blockNumberOrTag).toNumber(),
        timestamp: BigNumber.from(this.lastTimestamp).toNumber(),
      };
    }
    result = result?.result;
    if (result && result.hash && result.number && result.timestamp) {
      // Convert to Ethers compatible type
      this.lastTimestamp = result.timestamp;
      return {
        hash: result.hash,
        number: BigNumber.from(result.number).toNumber(),
        timestamp: BigNumber.from(result.timestamp).toNumber(),
      };
    }
    throw new Error(
      `Unable to parse result of eth_getBlockByNumber for ${blockNumberOrTag} on ${rpc}`
    );
  }
  async getBlocks(fromBlock: number, toBlock: number): Promise<Block[]> {
    const rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    const reqs: any[] = [];
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      reqs.push({
        jsonrpc: '2.0',
        id: (blockNumber - fromBlock).toString(),
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, false],
      });
    }
    const results = (await axios.post(rpc, reqs, AXIOS_CONFIG_JSON))?.data;
    if (results && results.length) {
      // Convert to Ethers compatible type
      return results.map(
        (response: undefined | { result?: Block; error?: ErrorBlock }, idx: number) => {
          // Karura is getting 6969 errors for some blocks, so we'll just return empty blocks for those instead of throwing an error.
          // We take the timestamp from the previous block, which is not ideal but should be fine.
          if (
            (response &&
              response.result === null &&
              fromBlock + idx < this.latestFinalizedBlockNumber - 1000) ||
            (response?.error && response.error?.code && response.error.code === 6969)
          ) {
            return {
              hash: '',
              number: BigNumber.from(fromBlock + idx).toNumber(),
              timestamp: BigNumber.from(this.lastTimestamp).toNumber(),
            };
          }
          if (
            response?.result &&
            response.result?.hash &&
            response.result.number &&
            response.result.timestamp
          ) {
            this.lastTimestamp = response.result.timestamp;
            return {
              hash: response.result.hash,
              number: BigNumber.from(response.result.number).toNumber(),
              timestamp: BigNumber.from(response.result.timestamp).toNumber(),
            };
          }
          this.logger.error(reqs[idx], response, idx);
          throw new Error(
            `Unable to parse result of eth_getBlockByNumber for ${fromBlock + idx} on ${rpc}`
          );
        }
      );
    }
    throw new Error(
      `Unable to parse result of eth_getBlockByNumber for range ${fromBlock}-${toBlock} on ${rpc}`
    );
  }
  async getLogs(
    fromBlock: number,
    toBlock: number,
    address: string,
    topics: string[]
  ): Promise<Array<Log>> {
    const rpc = RPCS_BY_CHAIN[this.network][this.chain];
    if (!rpc) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    const result = (
      await axios.post(
        rpc,
        [
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getLogs',
            params: [
              {
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                address,
                topics,
              },
            ],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data?.[0]?.result;
    if (result) {
      // Convert to Ethers compatible type
      return result.map((l: Log) => ({
        ...l,
        blockNumber: BigNumber.from(l.blockNumber).toNumber(),
        transactionIndex: BigNumber.from(l.transactionIndex).toNumber(),
        logIndex: BigNumber.from(l.logIndex).toNumber(),
      }));
    }
    throw new Error(`Unable to parse result of eth_getLogs for ${fromBlock}-${toBlock} on ${rpc}`);
  }

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching block ${this.finalizedBlockTag}`);
    const block: Block = await this.getBlock(this.finalizedBlockTag);
    this.latestFinalizedBlockNumber = block.number;
    return block.number;
  }

  // This only needs to return the latest block looked at.
  async getNttMessagesForBlocks(fromBlock: number, toBlock: number): Promise<string> {
    const nttAddresses = NTT_MANAGER_CONTRACT_ARRAY[this.network][this.chain];
    if (!nttAddresses) {
      throw new Error(`NTT manager contract not defined for ${this.network}`);
    }
    const address = contracts.coreBridge.get(this.network, this.chain);
    if (!address) {
      throw new Error(`Core contract not defined for ${this.chain}`);
    }
    let blockKey: string = '';
    for (const nttAddress of nttAddresses) {
      // Get and filter logs
      const logs: Log[] = (await this.getLogs(fromBlock, toBlock, nttAddress, [])).filter(
        isNttLifecycleEvent
      );
      const timestampsByBlock: { [block: number]: string } = {};
      // fetch timestamps for each block
      this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);
      const blocks = await this.getBlocks(fromBlock, toBlock);
      for (const block of blocks) {
        const timestamp = new Date(block.timestamp * 1000).toISOString();
        timestampsByBlock[block.number] = timestamp;
      }
      this.logger.info(`processing ${logs.length} logs`);
      for (const log of logs) {
        this.logger.debug(`log topic: ${log.topics[0]}`);
        const blockNumber = log.blockNumber;
        const txhash = log.transactionHash;
        this.logger.debug(`blockNumber: ${blockNumber}, txhash: ${txhash}`);
        if (log.topics[0] === TransferSentTopic) {
          this.logger.debug('***********TransferSentTopic***************');
          const decodedTransfer: decodedTransferSent = decodeNttTransferSent(log.data);
          this.logger.debug('decodedTransfer:', decodedTransfer);
          if (decodedTransfer.recipient === '') {
            this.logger.error('Could not decode transfer');
            continue;
          }
          const nttTransferKey = makeNttTransferKey(
            nttAddress,
            decodedTransfer.recipient,
            decodedTransfer.msgSequence
          );
          const coreLogs = await this.getLogs(blockNumber, blockNumber, address, [
            LOG_MESSAGE_PUBLISHED_TOPIC,
          ]);
          for (const coreLog of coreLogs) {
            if (coreLog.transactionHash !== txhash) {
              this.logger.error(
                `Mismatched transaction hashes: ${coreLog.transactionHash} vs ${txhash}`
              );
              continue;
            }
            let emitter = coreLog.topics[1].slice(2);
            // If this emitter is a relayer, parse differently
            const retval = wormholeInterface.parseLog(log);
            if (!retval || !retval.args || !retval.args.sequence || !retval.args.payload) {
              continue;
            }
            const sequence = retval.args.sequence;
            let payload = retval.args.payload;
            const vaaId = makeVaaId(chainToChainId(this.chain), emitter, sequence);
            // Strip off leading 0x, if present
            if (payload.startsWith('0x')) {
              payload = payload.slice(2);
            }
            let payloadBuffer;
            const isRelay: boolean = isRelayer(this.network, this.chain, emitter);
            if (isRelay) {
              this.logger.debug('Relayer detected');
              let { parsed } = parseWormholeLog(coreLog);
              if (typeof parsed === 'string') {
                payloadBuffer = Buffer.from(parsed, 'hex');
              } else if ('payload' in parsed) {
                payloadBuffer = parsed.payload;
              } else {
                this.logger.error('Could not parse payload');
                continue;
              }
            } else {
              this.logger.debug('Not a relayer');
              payloadBuffer = Buffer.from(payload, 'hex');
            }

            // This payload is a transceiver message
            // Use the payload to create a digest
            try {
              const transceiverMessage = WormholeTransceiverMessage.deserialize(
                payloadBuffer,
                (a) => NttManagerMessage.deserialize(a, NativeTokenTransfer.deserialize)
              );
              const calculatedDigest = getNttManagerMessageDigest(
                chainToChainId(this.chain),
                transceiverMessage.ntt_managerPayload
              );
              const sourceToken: string =
                transceiverMessage.ntt_managerPayload.payload.sourceToken.toString('hex');
              const lc: LifeCycle = {
                srcChainId: chainToChainId(this.chain),
                destChainId: decodedTransfer.recipientChain,
                sourceToken,
                tokenAmount:
                  transceiverMessage.ntt_managerPayload.payload.trimmedAmount.normalize(
                    NTT_DECIMALS
                  ),
                transferSentTxhash: txhash.startsWith('0x') ? txhash.slice(2) : txhash,
                transferBlockHeight: BigInt(blockNumber),
                redeemedTxhash: '',
                redeemedBlockHeight: 0n,
                nttTransferKey,
                vaaId,
                digest: calculatedDigest,
                isRelay,
                transferTime: timestampsByBlock[blockNumber],
                redeemTime: '',
                inboundTransferQueuedTime: '',
                outboundTransferQueuedTime: '',
                outboundTransferReleasableTime: '',
              };
              await saveToPG(this.pg, lc, TransferSentTopic, this.logger);
              this.logger.debug(
                `For txhash ${txhash}, correlating nttTransferKey ${nttTransferKey} to vaaId ${vaaId} and digest ${calculatedDigest}`
              );
            } catch (e) {
              this.logger.error('Error:', e);
            }
          }
        } else if (log.topics[0] === TransferRedeemedTopic) {
          this.logger.debug('***********TransferRedeemedTopic***************');
          let digest: string = log.topics[1];
          if (digest.startsWith('0x')) {
            digest = digest.slice(2);
          }
          this.logger.debug('digest:', digest);
          let lc: LifeCycle = createNewLifeCycle();
          lc.redeemedTxhash = txhash.startsWith('0x') ? txhash.slice(2) : txhash;
          lc.redeemedBlockHeight = BigInt(blockNumber);
          lc.digest = digest;
          lc.redeemTime = timestampsByBlock[blockNumber];
          lc.destChainId = chainToChainId(this.chain);
          await saveToPG(this.pg, lc, TransferRedeemedTopic, this.logger);
        } else if (log.topics[0] === InboundTransferQueuedTopic) {
          this.logger.debug('***********InboundTransferQueuedTopic***************');
          let digest: string = log.data;
          if (digest.startsWith('0x')) {
            digest = digest.slice(2);
          }
          this.logger.debug('digest:', digest);
          // Check if we have a lifecycle for this digest
          let lc: LifeCycle = createNewLifeCycle();
          lc.digest = digest;
          lc.inboundTransferQueuedTime = timestampsByBlock[blockNumber];
          await saveToPG(this.pg, lc, InboundTransferQueuedTopic, this.logger);
        } else if (log.topics[0] === OutboundTransferQueuedTopic) {
          this.logger.debug('***********OutboundTransferQueuedTopic***************');
          let digest: string = log.data;
          if (digest.startsWith('0x')) {
            digest = digest.slice(2);
          }
          this.logger.debug('digest:', digest);
          let lc: LifeCycle = createNewLifeCycle();
          lc.digest = digest;
          lc.outboundTransferQueuedTime = timestampsByBlock[blockNumber];
          await saveToPG(this.pg, lc, OutboundTransferQueuedTopic, this.logger);
        } else if (log.topics[0] === OutboundTransferRateLimitedTopic) {
          this.logger.debug('***********OutboundTransferRateLimitedTopic***************');
          let digest: string = log.data;
          if (digest.startsWith('0x')) {
            digest = digest.slice(2);
          }
          this.logger.debug('digest:', digest);
          let lc: LifeCycle = createNewLifeCycle();
          lc.digest = digest;
          lc.outboundTransferReleasableTime = timestampsByBlock[blockNumber];
          await saveToPG(this.pg, lc, OutboundTransferRateLimitedTopic, this.logger);
        } else {
          this.logger.warn(`Unhandled log topic: ${log.topics[0]}`);
        }
      }

      // Only update blockKey if we have a newer block
      if (blockKey === '' || toBlock > extractBlockFromKey(blockKey)) {
        // Create blockKey
        blockKey = makeBlockKey(toBlock.toString(), timestampsByBlock[toBlock]);
      }
    }
    return blockKey;
  }
}

type decodedTransferSent = {
  recipient: string;
  refundAddr: string;
  amount: string;
  fee: string;
  recipientChain: number;
  msgSequence: number;
};

/// event TransferSent( bytes32 recipient, uint256 amount, uint256 fee, uint16 recipientChain, uint64 msgSequence);
function decodeNttTransferSent(data: string): decodedTransferSent {
  //   event TransferSent(
  //     bytes32 recipient,
  //     bytes32 refundAddress,
  //     uint256 amount,
  //     uint256 fee,
  //     uint16 recipientChain,
  //     uint64 msgSequence
  // );
  // There are 6 fields in this message.  All of them are 32 bytes (64 characters in hex)
  // If data starts with '0x', we need to remove it
  if (data.startsWith('0x')) {
    data = data.slice(2);
  }
  let retVal: decodedTransferSent = {
    recipient: '',
    refundAddr: '',
    amount: '',
    fee: '',
    recipientChain: 0,
    msgSequence: 0,
  };
  if (data.length === 384) {
    retVal.recipient = data.slice(0, 64);
    retVal.refundAddr = '0x' + data.slice(64, 128);
    retVal.amount = '0x' + data.slice(128, 192);
    retVal.fee = '0x' + data.slice(192, 256);
    retVal.recipientChain = Number('0x' + data.slice(256, 320));
    retVal.msgSequence = Number('0x' + data.slice(320, 384));
  } else {
    throw new Error('Invalid data length.  Expected 384 characters.  Got ' + data.length);
  }
  return retVal;
}

function makeNttTransferKey(mgrAddress: string, recipient: string, seq: number): string {
  if (mgrAddress.startsWith('0x')) {
    mgrAddress = mgrAddress.slice(2);
  }
  if (recipient.startsWith('0x')) {
    recipient = recipient.slice(2);
  }
  return `${mgrAddress}/${recipient}/${seq}`;
}

export const makeVaaId = (chainId: number, emitter: string, seq: number): string =>
  `${chainId}/${emitter}/${seq}`;

function isNttLifecycleEvent(log: Log): boolean {
  return NTT_LIFECYCLE_TOPICS.some((topic) => log.topics[0].includes(topic));
}

async function saveToPG(pg: Knex, lc: LifeCycle, initiatingEvent: string, logger: WormholeLogger) {
  if (!pg) {
    throw new Error('pg not initialized');
  }
  if (lc.digest === '') {
    throw new Error('digest is empty');
  }

  logger.debug('saveToPG: Attempting to get existing record...');
  await pg.transaction(async (trx) => {
    const existing = await trx('life_cycle').where('digest', lc.digest).first();
    if (!existing) {
      logger.debug('saveToPG: Inserting new record');
      await trx('life_cycle').insert({
        from_chain: lc.srcChainId,
        to_chain: lc.destChainId,
        from_token: lc.sourceToken,
        token_amount: lc.tokenAmount,
        transfer_sent_txhash: lc.transferSentTxhash,
        transfer_block_height: lc.transferBlockHeight,
        redeemed_txhash: lc.redeemedTxhash,
        redeemed_block_height: lc.redeemedBlockHeight,
        ntt_transfer_key: lc.nttTransferKey,
        vaa_id: lc.vaaId,
        digest: lc.digest,
        is_relay: lc.isRelay,
        transfer_time: lc.transferTime.length > 0 ? formatIntoTimestamp(lc.transferTime) : null,
        redeem_time: lc.redeemTime.length > 0 ? formatIntoTimestamp(lc.redeemTime) : null,
        inbound_transfer_queued_time:
          lc.inboundTransferQueuedTime.length > 0
            ? formatIntoTimestamp(lc.inboundTransferQueuedTime)
            : null,
        outbound_transfer_queued_time:
          lc.outboundTransferQueuedTime.length > 0
            ? formatIntoTimestamp(lc.outboundTransferQueuedTime)
            : null,
        outbound_transfer_releasable_time:
          lc.outboundTransferReleasableTime.length > 0
            ? formatIntoTimestamp(lc.outboundTransferReleasableTime)
            : null,
      });
      return;
    }
    // If the row already exists, then we need to update it with the information from the initiating event
    logger.debug('saveToPG: Updating existing record');
    if (initiatingEvent === TransferSentTopic) {
      await trx('life_cycle')
        .where('digest', lc.digest)
        .update({
          from_chain: lc.srcChainId,
          to_chain: lc.destChainId,
          from_token: lc.sourceToken,
          token_amount: lc.tokenAmount,
          transfer_sent_txhash: lc.transferSentTxhash,
          transfer_block_height: lc.transferBlockHeight,
          is_relay: lc.isRelay,
          ntt_transfer_key: lc.nttTransferKey,
          vaa_id: lc.vaaId,
          transfer_time: formatIntoTimestamp(lc.transferTime),
        });
    } else if (initiatingEvent === TransferRedeemedTopic) {
      await trx('life_cycle')
        .where('digest', lc.digest)
        .update({
          to_chain: lc.destChainId,
          redeemed_txhash: lc.redeemedTxhash,
          redeemed_block_height: lc.redeemedBlockHeight,
          redeem_time: formatIntoTimestamp(lc.redeemTime),
        });
    } else if (initiatingEvent === InboundTransferQueuedTopic) {
      await trx('life_cycle')
        .where('digest', lc.digest)
        .update({
          inbound_transfer_queued_time: formatIntoTimestamp(lc.inboundTransferQueuedTime),
        });
    } else if (initiatingEvent === OutboundTransferQueuedTopic) {
      await trx('life_cycle')
        .where('digest', lc.digest)
        .update({
          outbound_transfer_queued_time: formatIntoTimestamp(lc.outboundTransferQueuedTime),
        });
    } else if (initiatingEvent === OutboundTransferRateLimitedTopic) {
      await trx('life_cycle')
        .where('digest', lc.digest)
        .update({
          outbound_transfer_releasable_time: formatIntoTimestamp(lc.outboundTransferReleasableTime),
        });
    } else {
      logger.error(`saveToPG: Unknown initiating event: ${initiatingEvent} and lifeCycle: ${lc}`);
    }
  });
}

function isRelayer(network: Network, chain: Chain, emitter: string): boolean {
  const relayer = contracts.relayer.get(network, chain);
  if (!relayer) {
    return false;
  }
  let relayerStr: string = relayer;
  if (relayerStr.startsWith('0x')) {
    relayerStr = relayerStr.slice(2);
  }
  // Strip leading 0x off emitter
  if (emitter.startsWith('0x')) {
    emitter = emitter.slice(2);
  }
  // The relayer and the emitter may not have the same length,
  // so pad the shorter one with leading 0s
  let len = Math.max(relayerStr.length, emitter.length);
  relayerStr = relayerStr.padStart(len, '0');
  emitter = emitter.padStart(len, '0');
  if (emitter.toLowerCase() === relayerStr.toLowerCase()) {
    return true;
  }
  return false;
}
