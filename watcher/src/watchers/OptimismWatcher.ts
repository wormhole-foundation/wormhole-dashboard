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
  rpc: string | undefined;

  constructor() {
    super('optimism');
  }

  async getFinalizedBlockNumber(): Promise<number> {
    const contract = new ethers.utils.Interface(ctcAbi);
    const gtbData = contract.encodeFunctionData('getTotalBatches');
    const result = (
      await axios.post(
        OPTIMISM_CTC_CHAIN_RPC,
        [
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_call',
            params: [
              { to: OPTIMISM_CTC_CHAIN_ADDRESS, data: gtbData },
              'finalized', // does the guardian use latest?
            ],
          },
        ],
        AXIOS_CONFIG_JSON
      )
    )?.data;

    const l2Block = contract
      .decodeFunctionResult('getTotalBatches', result?.[0]?.result)[0]
      .toNumber();

    this.logger.debug(`LatestL2Finalized = ${l2Block}`);
    return l2Block;
  }
}
