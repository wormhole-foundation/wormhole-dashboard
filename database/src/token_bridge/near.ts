import { Provider } from 'near-api-js/lib/providers';
import { CodeResult } from 'near-api-js/lib/providers/provider';

export async function hashAccount(
  provider: Provider,
  tokenBridge: string,
  account: string
): Promise<{ isRegistered: boolean; accountHash: string }> {
  // Near can have account names up to 64 bytes, but wormhole only supports 32
  // As a result, we have to hash our account names with sha256
  const [isRegistered, accountHash] = await callFunctionNear(
    provider,
    tokenBridge,
    'hash_account',
    { account }
  );
  return {
    isRegistered,
    accountHash,
  };
}

export async function hashLookup(
  provider: Provider,
  tokenBridge: string,
  hash: string
): Promise<{ found: boolean; value: string }> {
  const [found, value] = await callFunctionNear(provider, tokenBridge, 'hash_lookup', {
    hash,
  });
  return {
    found,
    value,
  };
}

export async function callFunctionNear(
  provider: Provider,
  accountId: string,
  methodName: string,
  args?: any
) {
  const response = await provider.query<CodeResult>({
    request_type: 'call_function',
    account_id: accountId,
    method_name: methodName,
    args_base64: args ? Buffer.from(JSON.stringify(args)).toString('base64') : '',
    finality: 'final',
  });
  return JSON.parse(Buffer.from(response.result).toString());
}
