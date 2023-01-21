import {
  ChainId,
  coalesceChainName,
  CONTRACTS,
  encode,
  hex,
  isEVMChain,
  Other,
  Signature,
  VAA,
} from '@certusone/wormhole-sdk';
import axios from 'axios';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../src/consts';
import { LOG_MESSAGE_PUBLISHED_TOPIC, wormholeInterface } from '../src/watchers/EVMWatcher';
import { Log } from '@ethersproject/abstract-provider';

const misses: { chain: ChainId; txHash: string }[] = [
  { chain: 11, txHash: '0x82c499401faa8642c1f773675fed38eaf79b8e55019b4bc002e04548e86b1927' },
  { chain: 11, txHash: '0xfa4b8d481ded6c09d939361f38143a3d003d5c0028dee7a433bc1a02c1173b88' },
  { chain: 11, txHash: '0x8dc9cc5a0a836c9206abd0702bc5133bbd901a509efdfc370940ca98b8cb1293' },
  { chain: 11, txHash: '0xd80c8b50e50b399543d70c1cb1110d9334f1ca5fe8d18e471a531e19b5fab769' },
  { chain: 11, txHash: '0x379a53ab3b696180ea3721ddd7ad81b1f3b8b9bee963524bf5265e8b3764f589' },
  { chain: 11, txHash: '0xd5c9d547877ae9fe8637f5f1f6662ae8fe7baeacfcf1ed61cdbde66241d1996a' },
  { chain: 11, txHash: '0x569d1888ff14f379952339f24fe9706cd274af7ddec0ac73d123512ec61250e4' },
  { chain: 11, txHash: '0x9382ad5d54ac1ce2a1da29e623f2b447220dcaaa9f6998cfa951e44675a1bd08' },
  { chain: 11, txHash: '0x2ee363bd0a8708755474013306213cffc8ca28d53a65f999b57ac7b89da7e231' },
  { chain: 11, txHash: '0x14180a4b1b056c71d473348203976f5b250e1c7342abd1947fa7de79195a91d4' },
  { chain: 11, txHash: '0x403c10df0d87dfca40783ee00aaed3c338b8e5a18643479d77ef2d9e667c5401' },
  { chain: 11, txHash: '0xa433e28d368f1478430ae195439698dacd645eb39e44a4c08efad383702c1ef6' },
  { chain: 11, txHash: '0x36707fcbd9136cda044ed178c70fea40c233855ac4d06b810bef3c0b23e2fbe8' },
  { chain: 11, txHash: '0x10daa711167a0333877bc29e53c240851f2aeb27917c9e980891766ba80d45b4' },
  { chain: 11, txHash: '0x922357276f1e116c5e9249035677ac2ec9b1a0fd31cc0cfa653563991f75fe8c' },
  { chain: 11, txHash: '0xbb1466fa50a5d2d6d9342a84800a99a74900c6942b4b4dbd22c7b8634396365a' },
  { chain: 11, txHash: '0xc06b5041d402531c991befde448d815ebf327b4ff76eaea1bf8e645fe9ffaca4' },
  { chain: 11, txHash: '0xa75a8fcbf135384420c0780a90f59edcbb3159bbb2b80dc100204a61b8f221bf' },
  { chain: 11, txHash: '0x48f532fdc933fc27afb73c580ade371e2d961dee8e56b496298f4bc4dddd19dc' },
  { chain: 11, txHash: '0xd16540dcddea5a467ecb5c100329e86495719f68d7b01d883379eaea2c2746ef' },
  { chain: 12, txHash: '0x531f78064f97c08875fb8e28054f7a52ea117440327a9ad8c4c9a0d091897098' },
  { chain: 12, txHash: '0x436a6676477dd90f0cf0e8a0e78126c6653c7fe2e44a5dc921dc1fa3d5c4853b' },
];

type GuardianSetEntry = { pubkey: string; name: string };

// https://github.com/wormhole-foundation/wormhole-networks/blob/master/mainnetv2/guardianset/v3.prototxt
const gs3: GuardianSetEntry[] = [
  {
    pubkey: '0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5',
    name: 'Certus One',
  },
  {
    pubkey: '0xfF6CB952589BDE862c25Ef4392132fb9D4A42157',
    name: 'Staked',
  },
  {
    pubkey: '0x114De8460193bdf3A2fCf81f86a09765F4762fD1',
    name: 'Figment',
  },
  {
    pubkey: '0x107A0086b32d7A0977926A205131d8731D39cbEB',
    name: 'ChainodeTech',
  },
  {
    pubkey: '0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2',
    name: 'Inotel',
  },
  {
    pubkey: '0x11b39756C042441BE6D8650b69b54EbE715E2343',
    name: 'HashQuark',
  },
  {
    pubkey: '0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd',
    name: 'Chainlayer',
  },
  {
    pubkey: '0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20',
    name: 'xLabs',
  },
  {
    pubkey: '0x74a3bf913953D695260D88BC1aA25A4eeE363ef0',
    name: 'Forbole',
  },
  {
    pubkey: '0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e',
    name: 'Staking Fund',
  },
  {
    pubkey: '0xAF45Ced136b9D9e24903464AE889F5C8a723FC14',
    name: 'MoonletWallet',
  },
  {
    pubkey: '0xf93124b7c738843CBB89E864c862c38cddCccF95',
    name: 'P2P.ORG Validator',
  },
  {
    pubkey: '0xD2CC37A4dc036a8D232b48f62cDD4731412f4890',
    name: '01Node',
  },
  {
    pubkey: '0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811',
    name: 'MCF',
  },
  {
    pubkey: '0x71AA1BE1D36CaFE3867910F99C09e347899C19C3',
    name: 'Everstake',
  },
  {
    pubkey: '0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf',
    name: 'Chorus One',
  },
  {
    pubkey: '0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8',
    name: 'Syncnode',
  },
  {
    pubkey: '0x5E1487F35515d02A92753504a8D75471b9f49EdB',
    name: 'Triton',
  },
  {
    pubkey: '0x6FbEBc898F403E4773E95feB15E80C9A99c8348d',
    name: 'Staking Facilities',
  },
];

function serialiseSignature(sig: Signature): string {
  const body = [encode('uint8', sig.guardianSetIndex), sig.signature];
  return body.join('');
}

function vaaBody(vaa: VAA<Other>) {
  let payload_str: string;
  payload_str = vaa.payload.hex;
  const body = [
    encode('uint32', vaa.timestamp),
    encode('uint32', vaa.nonce),
    encode('uint16', vaa.emitterChain),
    encode('bytes32', hex(vaa.emitterAddress)),
    encode('uint64', vaa.sequence),
    encode('uint8', vaa.consistencyLevel),
    payload_str,
  ];
  return body.join('');
}

export function serializeVAA(vaa: VAA<Other>) {
  const body = [
    encode('uint8', vaa.version),
    encode('uint32', vaa.guardianSetIndex),
    encode('uint8', vaa.signatures.length),
    ...vaa.signatures.map((sig) => serialiseSignature(sig)),
    vaaBody(vaa),
  ];
  return body.join('');
}

(async () => {
  for (const miss of misses) {
    const rpc = RPCS_BY_CHAIN[coalesceChainName(miss.chain)];
    if (!isEVMChain(miss.chain)) {
      console.error('unsupported chain (non EVM)', miss.chain);
      continue;
    }
    if (!rpc) {
      console.error('unsupported chain no rpc', miss.chain);
      continue;
    }
    let receipt: any;
    try {
      receipt = (
        await axios.post(
          rpc,
          {
            method: 'eth_getTransactionReceipt',
            params: [miss.txHash],
            id: 1,
            jsonrpc: '2.0',
          },
          AXIOS_CONFIG_JSON
        )
      ).data.result;
    } catch (e) {
      console.error('failed to get tx receipt for', miss.txHash);
      continue;
    }
    let timestamp: number;
    try {
      timestamp = parseInt(
        (
          await axios.post(
            rpc,
            {
              method: 'eth_getBlockByHash',
              params: [receipt.blockHash, false],
              id: 1,
              jsonrpc: '2.0',
            },
            AXIOS_CONFIG_JSON
          )
        ).data.result.timestamp,
        16
      );
    } catch (e) {
      console.error('failed to get timestamp for block', receipt.blockHash);
      continue;
    }
    // for now, just take the first WH message
    let emitterAddress;
    let parsed;
    for (const log of receipt.logs as Array<Log>) {
      if (
        log.address.toLowerCase() ===
          CONTRACTS.MAINNET[coalesceChainName(miss.chain)].core?.toLowerCase() &&
        log.topics[0] === LOG_MESSAGE_PUBLISHED_TOPIC
      ) {
        emitterAddress = log.topics[1];
        parsed = wormholeInterface.parseLog(log);
        break;
      }
    }
    if (!emitterAddress || !parsed) {
      console.error('failed to parse logs');
      continue;
    }
    const emitterChain = miss.chain;
    const {
      args: { nonce, sequence: bigSequence, payload, consistencyLevel },
    } = parsed;
    const sequence = bigSequence.toBigInt();
    let observations: any[];
    try {
      observations = (
        await axios.get(
          `http://api.staging.wormscan.io/api/v1/observations/${emitterChain}/${emitterAddress}/${sequence.toString()}`,
          AXIOS_CONFIG_JSON
        )
      ).data;
    } catch (e) {
      console.error('failed to get observations for', emitterChain, emitterAddress, sequence);
      continue;
    }

    // convert sigs to hex and find their index
    const hex_signatures: Signature[] = [];

    for (const observation of observations) {
      let sig_64 = Buffer.from(observation.signature, 'base64');
      const signature = sig_64.toString('hex');
      const address = observation.guardianAddr;
      const idx = gs3.findIndex((g) => g.pubkey.toLowerCase() === address.toLowerCase());
      if (idx === -1) {
        console.warn('skipping signature from guardian not in set');
        continue;
      }

      const guardianSig: Signature = {
        guardianSetIndex: idx,
        signature: signature,
      };
      hex_signatures.push(guardianSig);
    }
    const signatures = hex_signatures.sort((a, b) =>
      a.guardianSetIndex > b.guardianSetIndex ? 1 : -1
    );

    if (signatures.length < 13) {
      console.error('not enough signatures to create a valid vaa');
      console.error(miss.txHash);
      console.error(`${emitterChain}/${emitterAddress.slice(2)}/${sequence.toString()}`);
      console.error(`${signatures.length} signed`);
      for (let idx = 0; idx < gs3.length; idx++) {
        if (!signatures.find((s) => s.guardianSetIndex === idx)) {
          console.error(`missing signature for index ${idx}: ${gs3[idx].name} ${gs3[idx].pubkey}`);
        }
      }
      continue;
    }

    let vaa: VAA<Other> = {
      version: 1,
      guardianSetIndex: 3,
      signatures,
      timestamp,
      nonce,
      emitterChain,
      emitterAddress,
      sequence,
      consistencyLevel,
      payload: {
        type: 'Other',
        hex: payload.slice(2),
      },
    };

    console.log(miss.txHash);
    console.log(`${emitterChain}/${emitterAddress.slice(2)}/${sequence.toString()}`);
    console.log(serializeVAA(vaa));
  }
})();
