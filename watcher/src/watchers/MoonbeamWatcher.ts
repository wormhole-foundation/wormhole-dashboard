import { sleep } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { AXIOS_CONFIG_JSON, RPCS_BY_CHAIN } from '../consts';
import { EVMWatcher } from './EVMWatcher';
import { Network } from '@wormhole-foundation/sdk-base';

export class MoonbeamWatcher extends EVMWatcher {
  constructor(network: Network) {
    super(network, 'Moonbeam', 'latest', 'vaa');
  }
  async getFinalizedBlockNumber(): Promise<number> {
    const latestBlock = await super.getFinalizedBlockNumber();
    let isBlockFinalized = false;
    const rpc = RPCS_BY_CHAIN[this.network].Moonbeam;
    if (!rpc) {
      throw new Error('Moonbeam RPC is not defined!');
    }
    while (!isBlockFinalized) {
      await sleep(100);
      // refetch the block by number to get an up-to-date hash
      try {
        const blockFromNumber = await this.getBlock(latestBlock);
        isBlockFinalized =
          (
            await axios.post(
              rpc,
              [
                {
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'moon_isBlockFinalized',
                  params: [blockFromNumber.hash],
                },
              ],
              AXIOS_CONFIG_JSON
            )
          )?.data?.[0]?.result || false;
      } catch (e) {
        this.logger.error(`error while trying to check for finality of block ${latestBlock}`);
      }
    }
    return latestBlock;
  }
}
