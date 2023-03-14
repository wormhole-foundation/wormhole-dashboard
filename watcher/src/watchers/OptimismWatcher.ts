import axios from 'axios';
import { ethers } from 'ethers';
import {
  AXIOS_CONFIG_JSON,
  OPTIMISM_CTC_CHAIN_ADDRESS,
  OPTIMISM_CTC_CHAIN_RPC,
  // RPCS_BY_CHAIN,
} from '../consts';
import { EVMWatcher } from './EVMWatcher';
import ctcAbi from '../abi/OptimismCtcAbi.json';

export class OptimismWatcher extends EVMWatcher {
  constructor() {
    super('optimism');
  }

  async getFinalizedBlockNumber(): Promise<number> {
    if (!OPTIMISM_CTC_CHAIN_RPC) {
      throw new Error(`${this.chain} RPC is not defined!`);
    }
    const contract = new ethers.utils.Interface(ctcAbi);
    const gteData = contract.encodeFunctionData('getTotalElements');
    const result = (
      await axios.post(
        OPTIMISM_CTC_CHAIN_RPC,
        [
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_call',
            params: [{ to: OPTIMISM_CTC_CHAIN_ADDRESS, data: gteData }, 'finalized'],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data;

    const l2Block = contract
      .decodeFunctionResult('getTotalElements', result?.[0]?.result)[0]
      .toNumber();

    return l2Block;
  }
}
