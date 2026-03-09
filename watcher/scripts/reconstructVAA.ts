import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../src/consts';
import { LOG_MESSAGE_PUBLISHED_TOPIC, wormholeInterface } from '../src/watchers/EVMWatcher';
import { Log } from '@ethersproject/abstract-provider';
import { getNetwork, GUARDIAN_SET } from '@wormhole-foundation/wormhole-monitor-common';
import {
  ChainId,
  Network,
  chainToPlatform,
  contracts,
  toChain,
} from '@wormhole-foundation/sdk-base';

const network: Network = getNetwork();
const misses: { chain: ChainId; txHash: string }[] = [
  { chain: 5, txHash: '0x28ea54eb6bb9d80dfddfda4d0e10c538db4440b8cc84bf16a2cf6acf65fcbbf8' },
];

(async () => {
  for (const miss of misses) {
    const rpc = RPCS_BY_CHAIN[network][toChain(miss.chain)];
    if (chainToPlatform(toChain(miss.chain)) !== 'Evm') {
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
    // for now, just take the first WH message
    let emitterAddress;
    let parsed;
    for (const log of receipt.logs as Array<Log>) {
      if (
        log.address.toLowerCase() ===
          contracts.coreBridge.get(network, toChain(miss.chain))?.toLowerCase() &&
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
      args: { sequence: bigSequence },
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
    const hex_signatures: GuardianSignature[] = [];

    for (const observation of observations) {
      let sig_64 = Buffer.from(observation.signature, 'base64');
      const signature = sig_64.toString('hex');
      const address = observation.guardianAddr;
      const idx = GUARDIAN_SET.findIndex((g) => g.pubkey.toLowerCase() === address.toLowerCase());
      if (idx === -1) {
        console.warn('skipping signature from guardian not in set');
        continue;
      }

      const guardianSig: GuardianSignature = {
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
      for (let idx = 0; idx < GUARDIAN_SET.length; idx++) {
        if (!signatures.find((s) => s.guardianSetIndex === idx)) {
          console.error(
            `missing signature for index ${idx}: ${GUARDIAN_SET[idx].name} ${GUARDIAN_SET[idx].pubkey}`
          );
        }
      }
      continue;
    }

    let vaaData: WormholescanVaaData;
    try {
      vaaData = (
        await axios.get(
          `http://api.staging.wormscan.io/api/v1/vaas/${emitterChain}/${emitterAddress}/${sequence.toString()}`,
          AXIOS_CONFIG_JSON
        )
      ).data;
    } catch (e) {
      console.error('failed to get vaa for', emitterChain, emitterAddress, sequence);
      continue;
    }

    console.log(miss.txHash);
    console.log(`${emitterChain}/${emitterAddress.slice(2)}/${sequence.toString()}`);
    console.log(Buffer.from(vaaData.data.vaa, 'base64').toString('hex'));
  }
})();

type GuardianSignature = {
  guardianSetIndex: number;
  signature: string;
};

type WormholescanVaaData = {
  data: {
    sequence: number; //1353;
    id: string; //'5/000000000000000000000000f18f923480dc144326e6c65d4f3d47aa459bb41c/1353';
    version: number; //1;
    emitterChain: number; //5;
    emitterAddr: string; //'000000000000000000000000f18f923480dc144326e6c65d4f3d47aa459bb41c';
    emitterNativeAddr: string; //'0xf18f923480dc144326e6c65d4f3d47aa459bb41c';
    guardianSetIndex: number; //4;
    vaa: string; //'AQAAAAQNA3yD9LdCTsPY5S2JwDbJIcwvVUAZK3oapFigtQ1eIeKmCcQJ2uuStgtRrmXHmtlilALTV1tSsVWj0S72EJzoMqkBBMZlzntV/y9QLzieS0SKCIRUIPPfOKEbu14FwjrRdLdkfeefEw/URbBV3WbGYh36x8ra13tXBlphyfqMxq3NttoABdUEVVQkNbH4qGTy+YB+GU2lgwAwQpunl/quXCh+oKHuFkm6XiJJBlbyFDGlxA5k+ysq0xCCATWRdvcNzYIkU08BBs0jsdDqOHKIb2Pd6Ni4ETSi20d2i4xuMXL6Si3hmJxLfTlJSqJjxPOjSvsDLY91/i2Ewi/MS7+SDxtxDhCr30wAB1lh+PPll2vjgBShyGvBcyXVdBVIJIXPOPN2vcQ8En2odLCWpwSaO6+w9rR/0rBoBlDItBUlCkEPJ7uWrNIFwzoACaWmfV0yhJ+w8tS8JfUea+bEGaCSZQEvbRS7KkZPNkV3TkZq21TlEIjQMTNIFqo36tn3ZQaLh35x9k4foO7WGxUACz33kJtNkV1sw4+2DjI8HOurS+m4UELjtGWSuDrIFoYLWobK0hySKciWwUn3gi+w4gzEGpMKJKKBNSGzFbPTv68BDQtwrXxCVmm4ZnW/9SnV0BlRH35v0S2RwVmJiuJCBFKJAOV5RgNMxTzT2TiZ5cPpOD4K0IjT1ITdctskeygqq7oBDietsxI6l17X4w1Svmur4tznIzZaAy9LM0FeG/Lvl7GyO/1DbJAo7WWPSe2IuBBJWjbjQ0KL+tPkojZqFh0PYZ0BDxxCswb9E8Y8aF6xhOlQikQFXn/JtCtcwsrCz80URmlaYMbn9bipshPtfOv3oJj3f7U++WXYnHv4pCszhsIcXJAAEGTo5wXiIQJd+Pee1S8gf7u0HJRVSzi4MWvfXS/sQDApZrA1okWPbdmS+NDmY74OKvxH4pMzOoi38ZDmGY+KWS4BEZRFiZecTjI5YZ/P+XGggL21nMsY/4Q+pbrthfM4921ufoUUtltjkmpUQtx4ohj5Sp6maJVwcwZ4jeJ4En/eaKQAEub5AXZDIK3Zd33z0sGfAXTidOQKyaE42EJs0ZFRTjKzTiinxuBOE+h/Sll2Z/f5oANC6yeEDidEMPHcwGGYgqkBZi+zigAAAAAABQAAAAAAAAAAAAAAAPGPkjSA3BRDJubGXU89R6pFm7QcAAAAAAAABUkPAwEAAAAAAAFMrAAAAAcAAAAAAAAAAAAAAACnaGvOnSJyW22Xp0XlYx5uwWMeZgAAAAAAD0JAAAAAAAALhpo=';
    timestamp: string; //'2024-04-29T14:49:46Z';
    updatedAt: string; //'2024-04-29T14:51:20.407Z';
    indexedAt: string; //'2024-04-29T14:51:20.407Z';
    txHash: string; //'28ea54eb6bb9d80dfddfda4d0e10c538db4440b8cc84bf16a2cf6acf65fcbbf8';
    digest: string; //'21b0636951dc903e0d0384697a793cccb84479418b82f75541befa3354353fc9';
    isDuplicated: false;
  };
  pagination: { next: '' };
};
