import axios from 'axios';
import { keccak256 } from '@wormhole-foundation/sdk-definitions';

async function callContractMethod(
  rpc: string,
  contractAddress: string,
  methodId: string,
  params: string = ''
): Promise<string> {
  const data = methodId + params;

  const payload = {
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [
      {
        to: contractAddress,
        data,
      },
      'latest',
    ],
    id: 1,
  };

  try {
    const response = await axios.post(rpc, payload);
    if (response.data.error) {
      throw new Error(`Error calling contract method: ${response.data.error.message}`);
    }
    return response.data.result;
  } catch (e) {
    throw new Error(`Failed to call contract method: ${e}`);
  }
}

function getMethodId(methodSignature: string): string {
  const hashArray: Uint8Array = keccak256(methodSignature);
  const hashHex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hashHex.substring(0, 8);
}

export async function getCurrentOutboundCapacity(
  rpc: string,
  contractAddress: string
): Promise<bigint> {
  const methodId = getMethodId('getCurrentOutboundCapacity()');
  const result = await callContractMethod(rpc, contractAddress, methodId);
  return BigInt(result);
}

export async function getCurrentInboundCapacity(
  rpc: string,
  contractAddress: string,
  chainId: number
): Promise<bigint> {
  const methodId = getMethodId('getCurrentInboundCapacity(uint16)');
  const chainIdHex = chainId.toString(16).padStart(64, '0');
  const result = await callContractMethod(rpc, contractAddress, methodId, chainIdHex);
  return BigInt(result);
}

export async function getTokenDecimals(rpc: string, contractAddress: string): Promise<number> {
  const methodId = getMethodId('tokenDecimals()');
  const result = await callContractMethod(rpc, contractAddress, methodId);
  return Number(result);
}
