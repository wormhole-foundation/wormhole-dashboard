import { tryHexToNativeAssetString, tryHexToNativeStringNear } from './array';
import { getNetworkInfo, Network } from '@injectivelabs/networks';
import { ChainGrpcWasmApi } from '@injectivelabs/sdk-ts';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { LCDClient } from '@terra-money/terra.js';
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
import { LCDClient as TerraLCDClient } from '@terra-money/terra.js';
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
    } else if (tokenChain === chainToChainId('Terra2')) {
      const client = new LCDClient({
        URL: 'https://phoenix-lcd.terra.dev',
        chainID: 'phoenix-1',
      });
      return (
        (await queryExternalId(client, contracts.tokenBridge('Mainnet', 'Terra2'), tokenAddress)) ||
        null
      );
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
        fullnode: 'https://fullnode.mainnet.aptoslabs.com',
        network: AptosNetwork.MAINNET,
      });
      const client = new Aptos(config);
      const contracts = wh.getContracts('Aptos');
      if (!contracts) {
        return null;
      }
      const aptosTB = new AptosTokenBridge('Mainnet', 'Aptos', client, contracts);
      return await aptosTB.getTypeFromExternalAddress(tokenAddress);
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

// returns the TokenId corresponding to the ExternalTokenId
// see cosmwasm token_addresses.rs
export const queryExternalId = async (
  client: TerraLCDClient,
  tokenBridgeAddress: string,
  externalTokenId: string
) => {
  try {
    const response = await client.wasm.contractQuery<ExternalIdResponse>(tokenBridgeAddress, {
      external_id: {
        external_id: Buffer.from(externalTokenId, 'hex').toString('base64'),
      },
    });
    return (
      // response depends on the token type
      response.token_id.Bank?.denom ||
      response.token_id.Contract?.NativeCW20?.contract_address ||
      response.token_id.Contract?.ForeignToken?.foreign_address
    );
  } catch {
    return null;
  }
};
