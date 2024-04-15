import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';

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
