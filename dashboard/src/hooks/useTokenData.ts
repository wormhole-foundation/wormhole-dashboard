import axios from 'axios';
import { useEffect, useState } from 'react';

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

function useTokenData(): TokenDataByChainAddress | null {
  const [tokenData, setTokenData] = useState<TokenDataByChainAddress | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const response = await axios.get<{ data: TokenDataEntry[] }>(
          'https://europe-west3-wormhole-message-db-mainnet.cloudfunctions.net/latest-tokendata'
        );
        if (!cancelled) {
          setTokenData(
            response.data?.data.reduce<TokenDataByChainAddress>((obj, tokenData) => {
              obj[`${tokenData.token_chain}/${tokenData.token_address}`] = tokenData;
              return obj;
            }, {}) || null
          );
          await new Promise((resolve) => setTimeout(resolve, 60000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return tokenData;
}
export default useTokenData;
