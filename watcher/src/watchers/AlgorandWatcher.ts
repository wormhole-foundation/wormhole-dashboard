import * as msgpack from 'algo-msgpack-with-bigint';
import algosdk from 'algosdk';
import { sha512_256 } from 'js-sha512';

import { Watcher } from './Watcher';

import { ALGORAND_INFO } from '../consts';
import { VaasByBlock } from '../databases/types';
import { makeBlockKey, makeVaaKey } from '../databases/utils';

class Observation {
  emitter: string = '';
  sequence: bigint = BigInt(0);
  transactionHash: string = '';
}

// vendered from and with much thanks to https://github.com/barnjamin/sdk-extras/blob/master/js/block_fetcher.ts
//
// Once this settles out, I will PR all the fixes back into there..  it mostly worked...

class StateDelta {
  action: number = 0;
  bytes: Uint8Array = new Uint8Array();
  uint: number | undefined = undefined;

  static fromMsgp(state_delta: any): StateDelta {
    const sd = new StateDelta();
    if ('at' in state_delta) sd.action = state_delta['at'];
    if ('bs' in state_delta) sd.bytes = state_delta['bs'];
    if ('ui' in state_delta) sd.uint = state_delta['ui'];
    return sd;
  }

  get_obj_for_encoding() {
    const obj: any = {};
    if (this.action !== 0) obj['at'] = this.action;
    if (this.bytes.length > 0) obj['bs'] = this.bytes;
    if (this.uint !== undefined) obj['ui'] = this.uint;
    return obj;
  }
}

class EvalDelta {
  global_delta: StateDelta[] = [];
  local_deltas: { [key: number]: StateDelta[] } = {};
  logs: string[] = [];
  inner_txns: SignedTransactionWithAD[] = [];

  constructor(o: {
    global_delta?: StateDelta[];
    local_deltas?: { [key: number]: StateDelta[] };
    logs?: string[];
    inner_txns?: SignedTransactionWithAD[];
  }) {}

  static fromMsgp(delta: any, b: any): EvalDelta {
    const ed = new EvalDelta({});

    if ('gd' in delta) {
      ed.global_delta.push(StateDelta.fromMsgp(delta['gd']));
    }

    if ('ld' in delta) {
      for (const k of Object.keys(delta['ld'])) {
        let key = Number(k);
        if (!(key in ed.local_deltas)) {
          ed.local_deltas[key] = [];
        }
        ed.local_deltas[key].push(StateDelta.fromMsgp(delta['ld'][k]));
      }
    }

    if ('itx' in delta) {
      for (const itxn of delta['itx']) {
        ed.inner_txns.push(new SignedTransactionWithAD(itxn, b));
      }
    }

    if ('lg' in delta) ed.logs = delta['lg'];

    return ed;
  }

  get_obj_for_encoding() {
    const obj: any = {};

    if (this.global_delta.length > 0)
      obj['gd'] = this.global_delta.map((gd) => {
        return gd.get_obj_for_encoding();
      });
    if (Object.keys(this.local_deltas).length > 0) obj['ld'] = {};
    if (this.logs.length > 0) obj['lg'] = this.logs;
    if (this.inner_txns.length > 0)
      obj['itx'] = this.inner_txns.map((itxn) => {
        return itxn.get_obj_for_encoding();
      });

    return obj;
  }
}

class ApplyData {
  closing_amount: number = 0;
  asset_closing_amount: number = 0;
  sender_rewards: number = 0;
  receiver_rewards: number = 0;
  close_rewards: number = 0;
  eval_delta: EvalDelta | undefined = undefined;
  config_asset: number = 0;
  application_id: number = 0;

  constructor(o: {
    closing_amount?: 0;
    asset_closing_amount?: 0;
    sender_rewards?: 0;
    receiver_rewards?: 0;
    close_rewards?: 0;
    eval_delta?: undefined;
    config_asset?: 0;
    application_id?: 0;
  }) {}

  static fromMsgp(apply_data: any, b: any): ApplyData {
    const ad = new ApplyData({});

    if ('ca' in apply_data) ad.closing_amount = apply_data['ca'];
    if ('aca' in apply_data) ad.asset_closing_amount = apply_data['aca'];
    if ('rs' in apply_data) ad.sender_rewards = apply_data['rs'];
    if ('rr' in apply_data) ad.receiver_rewards = apply_data['rr'];
    if ('rc' in apply_data) ad.close_rewards = apply_data['rc'];
    if ('caid' in apply_data) ad.config_asset = apply_data['caid'];
    if ('apid' in apply_data) ad.application_id = apply_data['apid'];
    if ('dt' in apply_data) ad.eval_delta = EvalDelta.fromMsgp(apply_data['dt'], b);

    return ad;
  }

  get_obj_for_encoding() {
    const obj: any = {};

    if (this.closing_amount !== 0) obj['ca'] = this.closing_amount;
    if (this.asset_closing_amount !== 0) obj['aca'] = this.asset_closing_amount;
    if (this.sender_rewards !== 0) obj['rs'] = this.sender_rewards;
    if (this.receiver_rewards !== 0) obj['rr'] = this.receiver_rewards;
    if (this.close_rewards !== 0) obj['rc'] = this.close_rewards;
    if (this.config_asset !== 0) obj['caid'] = this.config_asset;
    if (this.application_id !== 0) obj['apid'] = this.application_id;
    if (this.eval_delta !== undefined) obj['dt'] = this.eval_delta.get_obj_for_encoding();

    return obj;
  }
}

class SignedTransactionWithAD {
  txn: algosdk.SignedTransaction;
  apply_data: ApplyData | undefined = undefined;

  constructor(stib: any, b: any) {
    const t = stib.txn as algosdk.EncodedTransaction;

    // Manually add gh/gen to construct a correct transaction object
    t.gh = b.block.gh;
    t.gen = b.block.gen;

    const stxn = {
      txn: algosdk.Transaction.from_obj_for_encoding(t),
    } as algosdk.SignedTransaction;

    if ('sig' in stib) stxn.sig = stib.sig;
    if ('lsig' in stib) stxn.lsig = stib.lsig;
    if ('msig' in stib) stxn.msig = stib.msig;
    if ('sgnr' in stib) stxn.sgnr = stib.sgnr;

    this.txn = stxn;

    this.apply_data = ApplyData.fromMsgp(stib, b);
  }

  getTxID(): string {
    return this.txn.txn.txID();
  }

  get_obj_for_encoding() {
    const txn: any = this.txn.txn.get_obj_for_encoding();
    if (txn.gen !== '') {
      delete txn.gen;
      delete txn.gh;
    }

    const obj: any = {
      txn: txn,
      ...this.apply_data?.get_obj_for_encoding(),
    };

    if (this.txn.sig) obj['sig'] = this.txn.sig;
    if (this.txn.lsig) obj['lsig'] = this.txn.lsig;
    if (this.txn.msig) obj['msig'] = this.txn.msig;
    if (this.txn.sgnr) obj['sgnr'] = this.txn.sgnr;
    if (this.txn.txn.genesisID !== '') obj['hgi'] = true;

    return obj;
  }

  hash(): Uint8Array {
    const obj = this.encode(this.get_obj_for_encoding());
    return this.hasher(obj);
  }

  encode(obj: Record<string | number | symbol, any>) {
    // enable the canonical option
    const options = { sortKeys: true };
    return msgpack.encode(obj, options);
  }
  hasher(data: Uint8Array): Uint8Array {
    const tohash = this.concatArrays(Buffer.from('STIB'), new Uint8Array(data));
    return new Uint8Array(sha512_256.array(tohash));
  }
  concatArrays(...arrs: ArrayLike<number>[]) {
    const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
    const c = new Uint8Array(size);

    let offset = 0;
    for (let i = 0; i < arrs.length; i++) {
      c.set(arrs[i], offset);
      offset += arrs[i].length;
    }

    return c;
  }
}

export class AlgorandWatcher extends Watcher {
  maximumBatchSize: number = 5;

  algodClient: algosdk.Algodv2;
  indexerClient: algosdk.Indexer;

  async getFinalizedBlockNumber(): Promise<number> {
    this.logger.info(`fetching final block for ${this.chain}`);

    let status = await this.algodClient.status().do();
    return status['last-round'];
  }

  processBlocks(blocks: any, vaasByBlock: VaasByBlock) {
    for (const block of blocks) {
      if (!block) {
        this.logger.error(`bad block`);
      }
      const timestamp = new Date(block.block.ts * 1000).toISOString();

      let vaas = [];
      for (const obs of this.scanBlock(block)) {
        vaas.push(
          makeVaaKey(obs.transactionHash, this.chain, obs.emitter, obs.sequence.toString())
        );
      }

      vaasByBlock[makeBlockKey(block.block.rnd.toString(), timestamp)] = vaas;
    }
  }

  async getMessagesForBlocks(fromBlock: number, toBlock: number): Promise<VaasByBlock> {
    let vaasByBlock: VaasByBlock = {};
    let blockPromises = [];
    this.logger.info(`fetching info for blocks ${fromBlock} to ${toBlock}`);

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      blockPromises.push(this.algodClient.block(blockNumber).do());
    }

    const blocks = await Promise.all(blockPromises);
    this.processBlocks(blocks, vaasByBlock);

    return vaasByBlock;
  }

  constructor() {
    super('algorand');

    this.algodClient = new algosdk.Algodv2(
      ALGORAND_INFO.algodToken,
      ALGORAND_INFO.algodServer,
      ALGORAND_INFO.algodPort
    );
    this.indexerClient = new algosdk.Indexer(
      ALGORAND_INFO.token,
      ALGORAND_INFO.server,
      ALGORAND_INFO.port
    );
  }

  scanTxn(stwad: SignedTransactionWithAD, rnd: number): Observation[] {
    let ret: Observation[] = [];

    if ('apply_data' in stwad) {
      let apply_data: ApplyData = stwad['apply_data'] as ApplyData;
      if ('eval_delta' in apply_data) {
        let eval_delta = apply_data['eval_delta'];
        if (eval_delta != undefined) {
          if (stwad.txn.txn.appIndex == ALGORAND_INFO.appid) {
            if (eval_delta.logs.length != 1) {
              this.logger.error(`txn log length error in ${rnd}`);
              return ret;
            }
            let obs = new Observation();

            obs.emitter = Buffer.from(stwad.txn.txn.from.publicKey).toString('hex');
            const seqBuf = Buffer.from(eval_delta.logs[0].slice(0, 8), 'hex');
            const padding = Buffer.from('0000000000000000', 'hex');
            const paddedSeqBuf = Buffer.concat([padding, seqBuf]);
            const finalSeqBuf = paddedSeqBuf.slice(paddedSeqBuf.length - 8);
            obs.sequence = finalSeqBuf.readBigUInt64BE(0);

            ret.push(obs);
          }
          for (const txn of eval_delta['inner_txns']) {
            ret = ret.concat(this.scanTxn(txn, rnd));
          }
        }
      }
    }
    return ret;
  }

  scanBlock(b: any): Observation[] {
    let ret: Observation[] = [];
    // handle empty blocks
    if (b.block.txns) {
      for (const stxn of b.block.txns) {
        try {
          // We know we won't see a wormhole message in a pay txn AND they seem to be malformed
          // as far as the sdk is concerned...
          if (stxn.txn.type == 'pay') {
            continue;
          }
          const stwad = new SignedTransactionWithAD(stxn, b);
          let obs = this.scanTxn(stwad, b.block.rnd);
          if (obs.length > 0) {
            // The txid of all observations (including ones generated from sub-txns) all have the same txid
            let txid = stwad.getTxID();
            for (let o of obs) {
              o.transactionHash = txid;
            }
            ret = ret.concat(obs);
          }
        } catch (error) {
          this.logger.error(`parse error in block ${b.block.rnd}`);
          this.logger.error(error);
        }
      }
    }
    return ret;
  }
}
