import axios from 'axios';
import { keccak256 } from '@wormhole-foundation/sdk-definitions';

// function getCurrentOutboundCapacity() external view returns (uint256);
export async function getCurrentOutboundCapacity(
  rpc: string,
  contractAddress: string
): Promise<bigint> {
  const data = getMethodId('getCurrentOutboundCapacity()');

  // JSON-RPC request payload
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
    const result = response.data.result;
    return BigInt(result);
  } catch (e) {
    throw new Error(`Failed to get current outbound capacity: ${e}`);
  }
}

export async function getCurrentInboundCapacity(
  rpc: string,
  contractAddress: string,
  chainId: number // Assuming chainId fits within the bounds of uint16
): Promise<bigint> {
  const methodId = getMethodId('getCurrentInboundCapacity(uint16)');

  // Encode the chainId parameter (uint16) to hex, padded to 32 bytes
  // Note: uint16 max value is 65535, so it's safe to use toString(16) directly
  const chainIdHex = chainId.toString(16).padStart(64, '0'); // 64 hex chars = 32 bytes

  // Combine method ID and parameter for the data field
  const data = methodId + chainIdHex;

  // JSON-RPC request payload
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
    const result = response.data.result;
    return BigInt(result);
  } catch (e) {
    throw new Error(`Failed to get current inbound capacity: ${e}`);
  }
}

export async function getTokenDecimals(rpc: string, contractAddress: string): Promise<number> {
  const data = getMethodId('tokenDecimals()');

  // JSON-RPC request payload
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
    const result = response.data.result;
    // decimals should be uint8 so this should be safe to cast
    return Number(result);
  } catch (e) {
    throw new Error(`Failed to get token decimals: ${e}`);
  }
}

function getMethodId(methodSignature: string): string {
  const hashArray = keccak256(methodSignature); // This is a Uint8Array

  // Convert Uint8Array to hex string
  const hashHex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Get the first 8 characters of the hex string
  return '0x' + hashHex.substring(0, 8);
}
