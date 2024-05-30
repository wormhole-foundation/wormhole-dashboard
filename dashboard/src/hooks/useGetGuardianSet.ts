import { Chain, chainToPlatform, rpc } from '@wormhole-foundation/sdk-base';
import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { WORMCHAIN_URL } from '../utils/consts';
import { queryContractSmart } from '../utils/queryContractSmart';

function useGetGuardianSet(chain: Chain, address: string | undefined) {
  const network = useNetworkContext();
  const [guardianSet, setGuardianSet] = useState<[bigint | null, string | null]>([null, null]);
  useEffect(() => {
    setGuardianSet([null, null]);
    if (!address) return;
    const rpcUrl =
      chain === 'Klaytn'
        ? 'https://klaytn-mainnet-rpc.allthatnode.com:8551'
        : chain === 'Near'
        ? 'https://rpc.mainnet.near.org'
        : chain === 'Wormchain'
        ? WORMCHAIN_URL
        : rpc.rpcAddress(network.currentNetwork.env, chain);
    if (!rpcUrl) return;
    let cancelled = false;
    const platform = chainToPlatform(chain);
    if (platform === 'Evm') {
      (async () => {
        try {
          const gsi = await callContractMethod(
            rpcUrl,
            address,
            getMethodId('getCurrentGuardianSetIndex()')
          );
          if (cancelled) return;
          const gs = await callContractMethod(
            rpcUrl,
            address,
            getMethodId('getGuardianSet(uint32)'),
            gsi.substring(2) // strip 0x
          );
          if (cancelled) return;
          setGuardianSet([BigInt(gsi), gs]);
        } catch (e) {}
      })();
    } else if (platform === 'Cosmwasm') {
      (async () => {
        try {
          const guardianSet = await queryContractSmart(rpcUrl, address, { guardian_set_info: {} });
          if (cancelled) return;
          setGuardianSet([
            BigInt(guardianSet.guardian_set_index),
            guardianSet.addresses
              .map(
                (address: { bytes: string }) =>
                  `0x${Buffer.from(address.bytes, 'base64').toString('hex')}`
              )
              .join(','),
          ]);
        } catch (e) {}
      })();
    } else if (platform === 'Solana') {
      (async () => {
        try {
          // TODO: test this, move to a cloud function
          // let gsi = 0;
          // let gsAddress = utils.deriveGuardianSetKey(address, gsi);
          // console.log(chain, gsi, gsAddress);
          // let gsAccountInfo = await makeRpcCall(
          //   rpcUrl,
          //   'getAccountInfo',
          //   [gsAddress],
          //   'jsonParsed'
          // );
          // let ret: [bigint | null, string | null] = [null, null];
          // while (gsAccountInfo !== null) {
          //   const gs = utils.GuardianSetData.deserialize(Buffer.from(gsAccountInfo, 'base64'));
          //   ret = [BigInt(gsi), gs.keys.map((k) => `0x${k.toString('hex')}`).join(',')];
          //   if (cancelled) return;
          //   gsi++;
          //   gsAddress = utils.deriveGuardianSetKey(address, gsi);
          //   console.log(chain, gsi, gsAddress);
          //   gsAccountInfo = await makeRpcCall(rpcUrl, 'getAccountInfo', [gsAddress], 'jsonParsed');
          // }
          // if (cancelled) return;
          // setGuardianSet(ret);
        } catch (e) {}
      })();
    } else if (platform === 'Algorand') {
      // https://developer.algorand.org/docs/rest-apis/algod/#get-v2applicationsapplication-id
      (async () => {
        try {
          const response = await axios.get(`${rpcUrl}/v2/applications/${address}`);
          const currentGuardianSetIndexState = response.data.params['global-state'].find(
            (s: any) => Buffer.from(s.key, 'base64').toString('ascii') === 'currentGuardianSetIndex'
          );
          if (cancelled) return;
          setGuardianSet([BigInt(currentGuardianSetIndexState.value.uint), null]);
        } catch (e) {}
      })();
    } else if (platform === 'Near') {
      // https://docs.near.org/api/rpc/contracts#view-contract-state
      (async () => {
        try {
          const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 'dontcare',
            method: 'query',
            params: {
              request_type: 'view_state',
              finality: 'final',
              account_id: address,
              prefix_base64: 'U1RBVEU=', // STATE
            },
          });
          const state = Buffer.from(
            response.data.result.values.find(
              (s: any) => Buffer.from(s.key, 'base64').toString('ascii') === 'STATE'
            ).value,
            'base64'
          ).toString('hex');
          // a tiny hack - instead of parsing the whole state, just find the expiry, which comes before the guardian set index
          // https://github.com/wormhole-foundation/wormhole/blob/main/near/contracts/wormhole/src/lib.rs#L109
          const expiry = `00004f91944e0000`; // = 24 * 60 * 60 * 1_000_000_000, // 24 hours in nanoseconds
          const expiryIndex = state.indexOf(expiry);
          const gsiIndex = expiryIndex + 16; // u64 len in hex
          const gsi = BigInt(
            `0x${state
              .substring(gsiIndex, gsiIndex + 8)
              .match(/../g)
              ?.reverse()
              .join('')}`
          );
          if (cancelled) return;
          setGuardianSet([gsi, null]);
        } catch (e) {}
      })();
    } else if (platform === 'Aptos') {
      // https://aptos.dev/nodes/aptos-api-spec/#/
      (async () => {
        try {
          const response = await axios.get(
            `${rpcUrl}/accounts/${address}/resource/${address}::state::WormholeState`
          );
          const gsi = BigInt(response.data.data.guardian_set_index.number);
          // const gsHandle = response.data.data.guardian_sets
          if (cancelled) return;
          setGuardianSet([gsi, null]);
        } catch (e) {}
      })();
    } else if (platform === 'Sui') {
      // https://docs.sui.io/sui-api-ref#sui_getobject
      (async () => {
        try {
          const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getObject',
            params: [
              address,
              {
                showType: false,
                showOwner: false,
                showPreviousTransaction: false,
                showDisplay: false,
                showContent: true,
                showBcs: false,
                showStorageRebate: false,
              },
            ],
          });
          const gsi = BigInt(response.data.result.data.content.fields.guardian_set_index);
          // const gsTable = response.data.result.data.content.fields.guardian_sets);
          if (cancelled) return;
          setGuardianSet([gsi, null]);
        } catch (e) {}
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [network.currentNetwork.env, chain, address]);
  return guardianSet;
}

export default useGetGuardianSet;
