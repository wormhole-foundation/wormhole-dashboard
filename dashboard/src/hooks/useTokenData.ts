import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';

export type TokenDataEntry = {
  token_chain: number;
  token_address: string;
  native_address: string;
  coin_gecko_coin_id: string;
  decimals: number;
  symbol: string;
  name: string;
  price_usd: string;
};

export type TokenDataByChainAddress = {
  [chainAddress: string]: TokenDataEntry;
};

export type TokenDataResult = {
  tokenData: TokenDataByChainAddress | null;
  receivedAt: string | null;
};

function useTokenData(): TokenDataResult {
  const { currentNetwork } = useNetworkContext();
  const skip = currentNetwork.type !== 'cloudfunction';
  const [result, setResult] = useState<TokenDataResult>({ tokenData: null, receivedAt: null });
  useEffect(() => {
    setResult({ tokenData: null, receivedAt: null });
    if (skip) return;
    let cancelled = false;
    (async () => {
      const response = await axios.get<{ data: TokenDataEntry[] }>(
        `${currentNetwork.endpoint}/latest-tokendata`
      );
      if (!cancelled) {
        setResult({
          tokenData:
            response.data?.data.reduce<TokenDataByChainAddress>((obj, tokenData) => {
              obj[`${tokenData.token_chain}/${tokenData.token_address}`] = tokenData;
              return obj;
            }, {}) || null,
          receivedAt: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork, skip]);
  return result;
}
export default useTokenData;
