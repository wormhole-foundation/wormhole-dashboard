import { Chain, chains, chainToPlatform, contracts, rpc } from '@wormhole-foundation/sdk-base';
import {
  assertEnvironmentVariable,
  callContractMethod,
  getMethodId,
  GuardianSetInfo,
  GuardianSetInfoByChain,
  makeRpcCall,
  queryContractSmart,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Firestore } from 'firebase-admin/firestore';
import { utils } from '@wormhole-foundation/sdk-solana-core';
import axios from 'axios';

export async function computeGuardianSetInfo(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  const infosByChain: GuardianSetInfoByChain = await getGuardianSetInfoByChain();

  await updateFirestore(infosByChain);
  res.status(200).send('successfully stored guardian set info');
  return;
}

async function getGuardianSetInfoByChain(): Promise<GuardianSetInfoByChain> {
  let infosByChain: GuardianSetInfoByChain = {};
  const infos = await Promise.all(
    chains.map((chain) => {
      const contract = contracts.coreBridge.get('Mainnet', chain); // Only support Mainnet for now
      if (!contract) {
        console.log(`No contract found for ${chain}`);
        return Promise.resolve(null);
      }
      return fetchGuardianSetInfo(chain, contract);
    })
  );
  for (let idx = 0; idx < chains.length; idx++) {
    const chain = chains[idx];
    const info = infos[idx];
    if (info) {
      infosByChain[chain] = info;
    }
  }
  console.log('Guardian set info:', infosByChain);
  return infosByChain;
}

async function fetchGuardianSetInfo(chain: Chain, address: string): Promise<GuardianSetInfo> {
  const timestamp: string = new Date().toISOString();
  const mt: GuardianSetInfo = {
    timestamp,
    contract: '',
    guardianSetIndex: '0',
    guardianSet: '',
  };
  if (!address) throw new Error('Address not found');
  const rpcUrl =
    chain === 'Klaytn'
      ? 'https://rpc.ankr.com/klaytn'
      : chain === 'Near'
      ? 'https://rpc.mainnet.near.org'
      : chain === 'Pythnet'
      ? 'http://pythnet.rpcpool.com'
      : rpc.rpcAddress('Mainnet', chain);
  if (!rpcUrl) {
    console.error(`Mainnet ${chain} rpc url not found`);
    return mt;
  }
  const platform = chainToPlatform(chain);
  try {
    if (platform === 'Evm') {
      const gsi = await callContractMethod(
        rpcUrl,
        address,
        getMethodId('getCurrentGuardianSetIndex()')
      );
      const gs = await callContractMethod(
        rpcUrl,
        address,
        getMethodId('getGuardianSet(uint32)'),
        gsi.substring(2) // strip 0x
      );
      return { timestamp, contract: address, guardianSetIndex: gsi, guardianSet: gs };
    } else if (platform === 'Cosmwasm') {
      const guardianSet = await queryContractSmart(rpcUrl, address, {
        guardian_set_info: {},
      });
      return {
        timestamp,
        contract: address,
        guardianSetIndex: guardianSet.guardian_set_index.toString(),
        guardianSet: guardianSet.addresses
          .map(
            (address: { bytes: string }) =>
              `0x${Buffer.from(address.bytes, 'base64').toString('hex')}`
          )
          .join(','),
      };
    } else if (platform === 'Solana') {
      let gsIdx = 0;
      let gsAddress = utils.deriveGuardianSetKey(address, gsIdx);
      // console.log(chain, gsIdx, gsAddress);
      let gsAccountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [gsAddress], 'jsonParsed');
      let ret: GuardianSetInfo = {
        timestamp,
        contract: '',
        guardianSetIndex: '0',
        guardianSet: '',
      };
      while (
        gsAccountInfo &&
        gsAccountInfo.value &&
        gsAccountInfo.value.data &&
        gsAccountInfo.value.data[0] !== null
      ) {
        const gs = utils.GuardianSetData.deserialize(
          Buffer.from(gsAccountInfo.value.data[0], 'base64')
        );
        ret = {
          timestamp,
          contract: address,
          guardianSetIndex: gsIdx.toString(),
          guardianSet: gs.keys.map((k) => `0x${k.toString('hex')}`).join(','),
        };
        gsIdx++;
        gsAddress = utils.deriveGuardianSetKey(address, gsIdx);
        // console.log(chain, gsIdx, gsAddress);
        gsAccountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [gsAddress], 'jsonParsed');
      }
      return ret;
    } else if (platform === 'Algorand') {
      const response = await axios.get(`${rpcUrl}/v2/applications/${address}`);
      const currentGuardianSetIndexState = response.data.params['global-state'].find(
        (s: any) => Buffer.from(s.key, 'base64').toString('ascii') === 'currentGuardianSetIndex'
      );
      return {
        timestamp,
        contract: address,
        guardianSetIndex: currentGuardianSetIndexState.value.uint.toString(),
        guardianSet: '',
      };
    } else if (platform === 'Near') {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'view_state',
          finality: 'final',
          account_id: address,
          prefix_base64: 'U1RBVEU=', // STATE
        },
      });
      const state = Buffer.from(
        response.data.result.values.find(
          (s: any) => Buffer.from(s.key, 'base64').toString('ascii') === 'STATE'
        ).value,
        'base64'
      ).toString('hex');
      // a tiny hack - instead of parsing the whole state, just find the expiry, which comes before the guardian set index
      // https://github.com/wormhole-foundation/wormhole/blob/main/near/contracts/wormhole/src/lib.rs#L109
      const expiry = `00004f91944e0000`; // = 24 * 60 * 60 * 1_000_000_000, // 24 hours in nanoseconds
      const expiryIndex = state.indexOf(expiry);
      const gsiIndex = expiryIndex + 16; // u64 len in hex
      const gsi = `0x${state
        .substring(gsiIndex, gsiIndex + 8)
        .match(/../g)
        ?.reverse()
        .join('')}`;
      return { timestamp, contract: address, guardianSetIndex: gsi, guardianSet: '' };
    } else if (platform === 'Aptos') {
      const response = await axios.get(
        `${rpcUrl}/accounts/${address}/resource/${address}::state::WormholeState`
      );
      const gsi = response.data.data.guardian_set_index.number.toString();
      // const gsHandle = response.data.data.guardian_sets
      return { timestamp, contract: address, guardianSetIndex: gsi, guardianSet: '' };
    } else if (platform === 'Sui') {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [
          address,
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
      });
      const gsi = response.data.result.data.content.fields.guardian_set_index.toString();
      // const gsTable = response.data.result.data.content.fields.guardian_sets);
      return { timestamp, contract: address, guardianSetIndex: gsi, guardianSet: '' };
    }
  } catch (e) {
    console.error(`Failed to get guardian set for ${chain}:`, e);
  }
  return mt;
}

async function updateFirestore(data: GuardianSetInfoByChain): Promise<void> {
  const firestore = new Firestore();
  const collection = firestore.collection(
    assertEnvironmentVariable('FIRESTORE_GUARDIAN_SET_INFO_COLLECTION')
  );
  try {
    for (const chain in data) {
      if (data.hasOwnProperty(chain)) {
        const chainData: GuardianSetInfo | undefined = data[chain as Chain];
        if (chainData) {
          const docRef = collection.doc(chain);
          await docRef.set(chainData);
        }
      }
    }
  } catch (e) {
    console.error('Error adding document: ', e);
  }
}
