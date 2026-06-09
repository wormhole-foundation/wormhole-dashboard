import { tryHexToNativeAssetString, tryHexToNativeStringNear } from './array';
import { getNetworkInfo, Network } from '@injectivelabs/networks';
import { ChainGrpcWasmApi } from '@injectivelabs/sdk-ts';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import {
  ChainId,
  chainIdToChain,
  chainToChainId,
  chainToPlatform,
  contracts,
  encoding,
} from '@wormhole-foundation/sdk-base';
import { Aptos, AptosConfig, Network as AptosNetwork } from '@aptos-labs/ts-sdk';
import { connect } from 'near-api-js';
import { AptosTokenBridge } from '@wormhole-foundation/sdk-aptos-tokenbridge';
import { wormhole } from '@wormhole-foundation/sdk';
import aptos from '@wormhole-foundation/sdk/aptos';
import { queryExternalIdInjective } from './injective';
import { getTokenCoinType } from '@wormhole-foundation/sdk-sui-tokenbridge';

export const getNativeAddress = async (
  tokenChain: ChainId,
  tokenAddress: string
): Promise<string | null> => {
  try {
    if (
      chainToPlatform(chainIdToChain(tokenChain)) === 'Evm' ||
      tokenChain === chainToChainId('Solana') ||
      tokenChain === chainToChainId('Algorand')
    ) {
      return tryHexToNativeAssetString(tokenAddress, tokenChain);
    } else if (tokenChain === chainToChainId('Injective')) {
      const client = new ChainGrpcWasmApi(getNetworkInfo(Network.MainnetK8s).grpc);
      return await queryExternalIdInjective(
        client,
        contracts.tokenBridge('Mainnet', 'Injective'),
        tokenAddress
      );
    } else if (tokenChain === chainToChainId('Aptos')) {
      const wh = await wormhole('Mainnet', [aptos]);
      const config = new AptosConfig({
        // `@aptos-labs/ts-sdk` 2.x expects the fullnode URL to include the
        // `/v1` version path; the old `aptos` 1.x `AptosClient` appended it
        // automatically. Without `/v1` every request 404s and the surrounding
        // try/catch silently returns null.
        fullnode: 'https://fullnode.mainnet.aptoslabs.com/v1',
        network: AptosNetwork.MAINNET,
      });
      const client = new Aptos(config);
      const contracts = wh.getContracts('Aptos');
      if (!contracts) {
        return null;
      }
      const aptosTB = new AptosTokenBridge('Mainnet', 'Aptos', client, contracts);
      // Accountant stores token addresses as raw hex (no `0x`). The Aptos REST
      // API rejects `vector<u8>` table keys without a `0x` prefix and the
      // surrounding try/catch silently returns null, which is why every chain
      // 22 metadata doc had `native_address: null`.
      const prefixed = tokenAddress.startsWith('0x') ? tokenAddress : `0x${tokenAddress}`;
      return await aptosTB.getTypeFromExternalAddress(prefixed);
    } else if (tokenChain === chainToChainId('Near')) {
      const NATIVE_NEAR_WH_ADDRESS =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const NATIVE_NEAR_PLACEHOLDER = 'near';
      if (tokenAddress === NATIVE_NEAR_WH_ADDRESS) {
        return NATIVE_NEAR_PLACEHOLDER;
      } else {
        const connection = await connect({
          nodeUrl: 'https://rpc.mainnet.near.org',
          networkId: 'mainnet',
        });
        return await tryHexToNativeStringNear(
          connection.connection.provider,
          contracts.tokenBridge('Mainnet', 'Near'),
          tokenAddress
        );
      }
    } else if (tokenChain === chainToChainId('Sui')) {
      const provider = new SuiClient({ url: getFullnodeUrl('mainnet') });
      return await getTokenCoinType(
        provider,
        contracts.tokenBridge('Mainnet', 'Sui'),
        encoding.hex.decode(tokenAddress),
        chainToChainId('Sui')
      );
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

export interface ExternalIdResponse {
  token_id: {
    Bank?: { denom: string };
    Contract?: {
      NativeCW20?: {
        contract_address: string;
      };
      ForeignToken?: {
        chain_id: string;
        foreign_address: string;
      };
    };
  };
}
