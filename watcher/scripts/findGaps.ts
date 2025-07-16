import * as dotenv from 'dotenv';
dotenv.config();
import { padUint16, sleep, WormholescanRPC } from '@wormhole-foundation/wormhole-monitor-common';
import * as fs from 'fs';
import ora from 'ora';
import { BigtableDatabase } from '../src/databases/BigtableDatabase';
import { BigtableSignedVAAsResultRow } from '../src/databases/types';
import {
  Chain,
  chainToChainId,
  chainToPlatform,
  contracts,
  encoding,
  rpc,
} from '@wormhole-foundation/sdk-base';
import Web3, { core } from 'web3';
import axios, { AxiosResponse } from 'axios';
import {
  getObjectFields,
  JsonRpcProvider,
  Connection as SuiConnection,
  TransactionBlock,
} from '@mysten/sui.js';
import { Connection, PublicKey } from '@solana/web3.js';
// import { DynamicFieldPage, SuiClient } from '@mysten/sui.js/client';
// import { TransactionBlock } from '@mysten/sui.js/dist/cjs/builder';

type EmitterToSequence = Map<string, number>;
// type ChainToEmitterToSequence = Map<number, EmitterToSequence>;

const LIMIT = 10000;
const evmEntries: Chain[] = [
  // 'Acala',
  // 'Arbitrum',
  // 'Aurora',
  // 'Avalanche',
  // 'Base',
  // 'Bsc',
  // 'Celo',
  // 'Ethereum',
  // 'Fantom',
  // 'Gnosis',
  // 'Karura',
  // 'Klaytn',
  // 'Moonbeam',
  // 'Neon',
  // 'Oasis',
  // 'Optimism',
  // 'Polygon',
  // 'Rootstock',
  // // 'Sepolia',
  // // 'ArbitrumSepolia',
  // // 'BaseSepolia',
  // // 'OptimismSepolia',
  // // 'Holesky',
  // // 'PolygonSepolia',
  // 'Mantle',
  // 'Scroll',
  // 'Blast',
  // 'Xlayer',
  // 'Linea',
  // 'Berachain',
  // 'Seievm',
  // 'Snaxchain',
];

const moveEntries: Chain[] = [
  // 'Sui',
  // 'Aptos',
];
const solanaEntries: Chain[] = ['Solana'];

const allEntries: Chain[] = [...evmEntries, ...moveEntries, ...solanaEntries];

(async () => {
  try {
    const bt = new BigtableDatabase();
    if (!bt.bigtable) {
      throw new Error('bigtable is undefined');
    }
    const instance = bt.bigtable.instance(bt.instanceId);
    const vaaTable = instance.table(bt.signedVAAsTableId);
    for (const chainName of allEntries) {
      const emitterMap: EmitterToSequence = new Map();
      const missingVAAs: string[] = [];
      const chainId = chainToChainId(chainName);
      let total = 0;
      let log = ora(`Fetching all ${chainName} VAAs...`).start();
      let start = `${padUint16(chainId.toString())}/`;
      while (start) {
        log.text = `Fetching ${LIMIT}/${total} ${chainName} VAAs starting at ${start}...`;
        let vaaRows: BigtableSignedVAAsResultRow[] = (
          await vaaTable.getRows({
            start,
            end: `${padUint16(chainId.toString())}/z`,
            decode: false,
            limit: LIMIT,
          })
        )[0] as BigtableSignedVAAsResultRow[];
        start = vaaRows.length === LIMIT ? vaaRows[LIMIT - 1].id : '';
        vaaRows = vaaRows.filter((row) => row.id.toString() !== start.toString());
        total += vaaRows.length;
        log.text = `Processing ${total} ${chainName} VAAs...`;
        for (const row of vaaRows) {
          try {
            // console.log(`Processing ${row.id.toString()}`);
            const vaaBytes = row.data.info.bytes?.[0].value;
            if (vaaBytes) {
              // Get the emitter and sequence from the row id
              // Check if the emitter is already in the map
              // Update the sequence if the new sequence is greater and check for gap
              // If there is a gap, log the gap
              // Update the map with the new sequence
              const r_id = row.id.toString();
              const id: string[] = r_id.split('/');
              const chain = parseInt(id[0]);
              if (chain !== chainId) {
                start = '';
                break;
              }
              start = '';
              const emitter = id[1];
              const sequence = parseInt(id[2]);
              // console.log(`Processing ${chainName} VAA ${emitter} ${sequence}`);
              if (emitterMap.has(emitter)) {
                const seq = emitterMap.get(emitter);
                // console.log(`Emitter ${emitter} found in map, with seq ${seq} and new sequence ${sequence}`);
                if (seq !== undefined && sequence > seq) {
                  if (sequence - seq > 1) {
                    console.log(
                      `Gap detected for emitter ${emitter} between ${seq} and ${sequence}`
                    );
                    // Gap size needs to be <= 100
                    if (sequence - seq > 100) {
                      console.log(
                        `Gap is too large to record for emitter ${emitter} between ${seq} and ${sequence}`
                      );
                    } else {
                      for (let i = seq + 1; i < sequence; i++) {
                        missingVAAs.push(`${chainId}/${emitter}/${i}`);
                      }
                    }
                  }
                  emitterMap.set(emitter, sequence);
                  // console.log(`Emitter ${emitter} updated with sequence ${sequence}`);
                } else {
                  console.log(
                    `Emitter ${emitter} has an old sequence ${sequence}. Expected a number > ${seq}`
                  );
                }
              } else {
                emitterMap.set(emitter, sequence);
                // console.log(`Emitter ${emitter} added with sequence ${sequence}`);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
        if (start === '') {
          break;
        }
      }
      log.succeed(`Processed ${total} ${chainName} VAAs...`);
      console.log(`There are ${emitterMap.size} emitters`);
      const mapArray = Array.from(emitterMap);
      const csvContent = mapArray.map((row) => row.join(',')).join('\n');
      fs.writeFileSync(`emitter-sequence-${chainName}.csv`, csvContent);
      // Walk all the emitters and get what should be the next sequence from the core contract
      log = ora(`Fetching all VAAs...`).start();
      let i = 1;
      const totalEmitters = emitterMap.size;
      const coreContract = contracts.coreBridge.get('Mainnet', chainName);
      if (!coreContract) {
        throw new Error(`Core contract not found for ${chainName}`);
      }
      const RPC = rpc.rpcAddress('Mainnet', chainName);
      if (!RPC) {
        throw new Error(`RPC not found for ${chainName}`);
      }
      for (const [emitter, sequence] of emitterMap) {
        log.text = `Processing ${i++}/${totalEmitters} emitter ${emitter}...`;
        let nextSeq: number = 0;
        if (chainToPlatform(chainName) === 'Evm') {
          nextSeq = await abiCall(RPC, coreContract, emitter.slice(-40));
          // Check if any sequences are missing
          if (nextSeq > sequence + 1) {
            console.log(`Gap detected for emitter ${emitter} between ${sequence} and ${nextSeq}`);
            for (let j = sequence + 1; j < nextSeq; j++) {
              missingVAAs.push(`${chainId}/${emitter}/${j}`);
            }
          }
        } else if (chainName === 'Sui') {
          const vaaKey = `${chainId}/${emitter}/${sequence}`;
          nextSeq = await suiCall(RPC, vaaKey, emitter.slice(-40));
        } else if (chainName === 'Aptos') {
          const vaaKey = `${chainId}/${emitter}/${sequence}`;
          console.log(`Processing ${vaaKey}`);
          const localRPC: string = 'https://api.mainnet.aptoslabs.com';
          nextSeq = await aptosCall(localRPC, vaaKey);
        } else if (chainName === 'Solana') {
          nextSeq = await solanaCall(RPC, emitter);
        } else {
          console.log(`Chain ${chainName} not supported`);
          continue;
        }
        // Check if any sequences are missing
        if (nextSeq > sequence + 1) {
          console.log(`Gap detected for emitter ${emitter} between ${sequence} and ${nextSeq}`);
          for (let j = sequence + 1; j < nextSeq; j++) {
            missingVAAs.push(`${chainId}/${emitter}/${j}`);
          }
        }
      }
      log.succeed(`Processed ${totalEmitters} emitters...`);
      const missingContent = missingVAAs.join('\n');
      fs.writeFileSync(`missing-vaas-${chainName}.csv`, missingContent);
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();

async function abiCall(rpc: string, coreContract: string, emitter: string): Promise<number> {
  let done: boolean = false;
  let results;
  while (!done) {
    try {
      let web3: Web3 = new Web3(rpc);
      const callData = web3.eth.abi.encodeFunctionCall(
        {
          // this is the snippet from the ABI, you can grab that from the explorer
          inputs: [{ internalType: 'address', name: 'emitter', type: 'address' }],
          name: 'nextSequence',
          outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
          stateMutability: 'view',
          type: 'function',
        },
        [emitter] // these are the parameters
      );
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            from: null,
            to: coreContract,
            data: callData,
          },
          'latest',
        ],
        id: 1,
      };
      results = await axios.post(rpc, payload, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
        },
      });
      // console.log(results.data);
      if (results && results.data && results.data.result) {
        return parseInt(results.data.result);
      }
    } catch (e: any) {
      if (e.response && e.response.status && e.response.status === 429) {
        // sleep for 1 second and try again
        console.log('Rate limited, sleeping for 1 second');
        await sleep(1000);
      } else {
        console.error('Non-Rate limited error', e);
        console.log(`Error = ${e.response.data.error.message}`);
        done = true;
      }
    }
  }
  return 0;
}

async function suiCall(rpc: string, vaaKey: string, emitter: string): Promise<number> {
  // 1. Get the txHash from wormholescan
  // 2. Get the txBlock from Sui
  // 3. Get the emitter object

  const url: string = WormholescanRPC['Mainnet'] + 'api/v1/vaas/' + vaaKey;
  console.log(`url = ${url}`);
  try {
    const response = await axios.get(url);
    // console.log(response.data);
    const txHash = response.data.data.txHash;
    console.log(`txHash = ${txHash}`);

    const getTxPayload = {
      jsonrpc: '2.0',
      method: 'sui_getTransactionBlock',
      params: [
        `${txHash}`,
        {
          showInput: true,
          showRawInput: false,
          showEffects: false,
          showEvents: false,
          showObjectChanges: true,
          showBalanceChanges: false,
          showRawEffects: false,
        },
      ],
      id: 1,
    };

    const results = await axios.post(rpc, getTxPayload, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
      },
    });
    // console.log(results.data);
    let objectId: string = '';
    let gotEmitterCap: boolean = false;
    let gotWHAdapter: boolean = false;
    let gotState: boolean = false;
    if (results && results.data && results.data.result) {
      const changes = results.data.result.objectChanges;
      // console.log(JSON.stringify(changes));
      for (const change of changes) {
        if (change.type && change.type === 'mutated') {
          if (change.owner) {
            if (change.owner.Shared && change.owner.Shared.initial_shared_version > 64) {
              // console.log(
              //   `\nFound Shared object with version = ${change.owner.Shared.initial_shared_version}`
              // );
              // Grab this object's id
              objectId = change.objectId;
              if (change.objectType) {
                gotEmitterCap = change.objectType.includes('EmitterCap');
                if (gotEmitterCap) break;
                gotWHAdapter = change.objectType.includes('wormhole_adapter');
                if (gotWHAdapter) break;
                gotState = change.objectType.includes('state::State');
                if (gotState) break;
              }
            }
          }
        }
      }
      if (gotEmitterCap) {
        console.log(`\nFound EmitterCap object with id = ${objectId}`);
        const objResults = await getObjectFromSui(rpc, objectId);
        // console.log('objResults: ' + JSON.stringify(objResults.data));
        if (
          objResults &&
          objResults.data &&
          objResults.data.result &&
          objResults.data.result.data &&
          objResults.data.result.data.content
        ) {
          const fields = objResults.data.result.data.content.fields;
          // console.log(`Fields = ${JSON.stringify(fields)}`);
          if (fields.id && fields.sequence) {
            console.log(`\nEmitter ${fields.id.id} has sequence ${fields.sequence}`);
            return parseInt(fields.sequence);
          }
        }
      } else if (gotWHAdapter) {
        console.log(`\nFound wormhole_adapter object with id = ${objectId}`);
        const objResults = await getObjectFromSui(rpc, objectId);
        // console.log('objResults: ' + JSON.stringify(objResults.data));
        if (
          objResults &&
          objResults.data &&
          objResults.data.result &&
          objResults.data.result.data &&
          objResults.data.result.data.content
        ) {
          const fields = objResults.data.result.data.content.fields;
          // console.log(`Fields = ${JSON.stringify(fields)}`);
          if (fields.wormhole_emitter && fields.wormhole_emitter.fields) {
            const innerFields = fields.wormhole_emitter.fields;
            console.log(`\nEmitter ${innerFields.id.id} has sequence ${innerFields.sequence}`);
            return parseInt(innerFields.sequence);
          }
        }
      } else if (gotState) {
        // console.log(`\nFound state object with id = ${objectId}`);
        const objResults = await getObjectFromSui(rpc, objectId);
        // console.log('objResults: ' + JSON.stringify(objResults.data));
        if (
          objResults &&
          objResults.data &&
          objResults.data.result &&
          objResults.data.result.data &&
          objResults.data.result.data.content
        ) {
          const fields = objResults.data.result.data.content.fields;
          // console.log(`Fields = ${JSON.stringify(fields)}`);
          if (fields.emitter_cap && fields.emitter_cap.fields) {
            const innerFields = fields.emitter_cap.fields;
            console.log(`\nEmitter ${innerFields.id.id} has sequence ${innerFields.sequence}`);
            return parseInt(innerFields.sequence);
          }
        }
      }
    }
  } catch (e) {
    // console.error(e);
  }

  return 0;
}

async function getObjectFromSui(rpc: string, objectId: string): Promise<AxiosResponse<any, any>> {
  const objPayload = {
    jsonrpc: '2.0',
    method: 'sui_getObject',
    params: [
      `${objectId}`,
      {
        showType: false,
        showOwner: false,
        showPreviousTransaction: false,
        showDisplay: false,
        showContent: true,
        showBcs: false,
        showStorageRebate: false,
      },
    ],
    id: 2,
  };
  const objResults = await axios.post(rpc, objPayload, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
    },
  });
  return objResults;
}

async function aptosCall(rpc: string, vaaKey: string): Promise<number> {
  // 1. Get the txHash from wormholescan
  // 2. Get the txBlock from Sui
  // 3. Get the emitter object

  const url: string = WormholescanRPC['Mainnet'] + 'api/v1/vaas/' + vaaKey;
  // console.log(`url = ${url}`);
  try {
    const response = await axios.get(url);
    // console.log(response.data);
    const txHash = response.data.data.txHash;
    if (!txHash) {
      console.log(`No txHash found for ${vaaKey}`);
      return 0;
    }
    // console.log(`txHash = ${txHash}`);

    const getTxUrl: string = `${rpc}/v1/transactions/by_hash/${txHash}`;
    // console.log(`getTxUrl = ${getTxUrl}`);
    const results = await axios.get(getTxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
      },
    });
    // console.log(results.data);
    const changes = results.data.changes;
    // Walk the changes
    for (const change of changes) {
      // console.log(`Change = ${JSON.stringify(change)}`);
      if (!change.data || !change.data.data) {
        continue;
      }
      // console.log(`\nChange data = ${JSON.stringify(change.data)}`);
      // if (
      //   change.data.type &&
      //   (change.data.type.includes('state::State') || change.data.type.includes('sender::State'))
      // ) {
      const data = change.data.data;
      if (data.emitter_cap && data.emitter_cap.sequence) {
        console.log(
          `\nEmitter ${data.emitter_cap.emitter} has sequence ${data.emitter_cap.sequence}`
        );
        return parseInt(data.emitter_cap.sequence);
      }
      // }
    }
  } catch (e) {
    console.error(e);
  }
  return 0;
}

async function solanaCall(rpc: string, emitter: string): Promise<number> {
  console.log(`Processing ${emitter}`);
  const coreContract = contracts.coreBridge.get('Mainnet', 'Solana');
  if (!coreContract) {
    throw new Error(`Core contract not found for Solana`);
  }
  try {
    const sequenceAcct = PublicKey.findProgramAddressSync(
      [Buffer.from('Sequence'), new PublicKey(Buffer.from(emitter, 'hex')).toBytes()],
      new PublicKey(coreContract)
    )[0];
    console.log(`Sequence account = ${sequenceAcct.toString()}`);
    const connection = new Connection(rpc);
    const response = await connection.getAccountInfo(sequenceAcct);
    // console.log(`Response = ${JSON.stringify(response)}`);
    if (!response) {
      console.log(`No sequence account found for ${emitter}`);
      return 0;
    }
    const sequence = response.data.readBigUInt64LE(0);
    console.log(`Sequence = ${sequence}`);

    return parseInt(sequence.toString());
  } catch (e) {
    console.error(e);
  }
  return 0;
}
