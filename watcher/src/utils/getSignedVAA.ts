import axios from 'axios';
import { AXIOS_CONFIG_JSON, GUARDIAN_RPC_HOSTS } from '../consts';
import { Environment, getEnvironment } from '@wormhole-foundation/wormhole-monitor-common';

export const getSignedVAA = async (
  chain: number,
  emitter: string,
  sequence: string
): Promise<Buffer | null> => {
  const environment: Environment = getEnvironment();
  for (const host of GUARDIAN_RPC_HOSTS[environment]) {
    try {
      const result = await axios.get(
        `${host}/v1/signed_vaa/${chain}/${emitter}/${sequence.toString()}`,
        AXIOS_CONFIG_JSON
      );
      if (result.data.vaaBytes) {
        return Buffer.from(result.data.vaaBytes, 'base64');
      }
    } catch (e) {}
  }
  return null;
};
