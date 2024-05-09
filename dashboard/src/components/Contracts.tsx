import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Chain,
  chainToChainId,
  chainToPlatform,
  chains,
  contracts,
  rpc,
} from '@wormhole-foundation/sdk-base';
import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { WORMCHAIN_URL } from '../utils/consts';
import { queryContractSmart } from '../utils/queryContractSmart';
import CollapsibleSection from './CollapsibleSection';

const coreBridgeChains = chains.filter(
  (chain) => chain !== 'Aurora' && contracts.coreBridge.get('Mainnet', chain)
);

function useGetGuardianSet(chain: Chain, address: string | undefined) {
  const network = useNetworkContext();
  const [guardianSet, setGuardianSet] = useState<[bigint | null, string | null]>([null, null]);
  useEffect(() => {
    setGuardianSet([null, null]);
    if (!address) return;
    const rpcUrl =
      chain === 'Wormchain' ? WORMCHAIN_URL : rpc.rpcAddress(network.currentNetwork.env, chain);
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
    }
    return () => {
      cancelled = true;
    };
  }, [network.currentNetwork.env, chain, address]);
  return guardianSet;
}

function CoreBridgeInfo({ chain, address }: { chain: Chain; address: string | undefined }) {
  const guardianSet = useGetGuardianSet(chain, address);
  const guardianSetIndex = guardianSet[0]?.toString();
  if (!address) return null;
  return (
    <TableRow>
      <TableCell>{chain}</TableCell>
      <TableCell>{chainToChainId(chain)}</TableCell>
      <TableCell>{address}</TableCell>
      <TableCell>{guardianSetIndex}</TableCell>
    </TableRow>
  );
}

function Contracts() {
  const { currentNetwork } = useNetworkContext();
  return currentNetwork.name === 'Mainnet' ? (
    <CollapsibleSection header="Core">
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Chain Name</TableCell>
                <TableCell>Chain ID</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Guardian Set Index</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coreBridgeChains.map((chain: Chain) => (
                <CoreBridgeInfo
                  key={chain}
                  chain={chain}
                  address={contracts.coreBridge.get('Mainnet', chain)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </CollapsibleSection>
  ) : (
    <Box textAlign="center" my={8} mx={4}>
      <Typography variant="h3">Contract info is currently only supported in Mainnet</Typography>
    </Box>
  );
}
export default Contracts;
