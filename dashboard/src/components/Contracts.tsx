import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Chain,
  chainToChainId,
  chainToPlatform,
  chains,
  contracts,
  rpc,
} from '@wormhole-foundation/sdk-base';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import CollapsibleSection from './CollapsibleSection';
import { callContractMethod, getMethodId } from '@wormhole-foundation/wormhole-monitor-common';

const coreBridgeChains = chains.filter((chain) => contracts.coreBridge.get('Mainnet', chain));

function useGetGuardianSet(chain: Chain, address: string | undefined) {
  const network = useNetworkContext();
  const [guardianSet, setGuardianSet] = useState<[bigint | null, string | null]>([null, null]);
  useEffect(() => {
    setGuardianSet([null, null]);
    if (!address) return;
    let cancelled = false;
    if (chainToPlatform(chain) === 'Evm') {
      const rpcUrl = rpc.rpcAddress(network.currentNetwork.env, chain);
      if (!rpcUrl) return;
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
  return (
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
  );
}
export default Contracts;
