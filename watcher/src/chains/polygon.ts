import axios from 'axios';
import { ethers } from 'ethers';
import { POLYGON_ROOT_CHAIN_ADDRESS, POLYGON_ROOT_CHAIN_RPC } from '../consts';
import { GetFinalizedBlockNumberResult } from '../watch';

export async function getFinalizedBlockNumberForPolygon(): GetFinalizedBlockNumberResult {
  console.log('fetching Polygon last child block from Ethereum');
  const rootChain = new ethers.utils.Interface([`function getLastChildBlock() external view returns (uint256)`]);
  const callData = rootChain.encodeFunctionData('getLastChildBlock');
  try {
    const callResult = (
      await axios.post(POLYGON_ROOT_CHAIN_RPC, [
        {
          jsonrpc: '2.0',
          id: '1',
          method: 'eth_call',
          params: [
            { to: POLYGON_ROOT_CHAIN_ADDRESS, data: callData },
            'latest', // does the guardian use latest?
          ],
        },
      ])
    )?.data?.[0]?.result;
    const block = rootChain.decodeFunctionResult('getLastChildBlock', callResult)[0].toNumber();
    console.log('rooted child block', block);
    return block;
  } catch (e) {
    console.error('error fetching last child block');
    return null;
  }
}
