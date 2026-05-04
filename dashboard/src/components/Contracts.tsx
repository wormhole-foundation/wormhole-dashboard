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
import { Chain, chainToChainId, chains, contracts } from '@wormhole-foundation/sdk-base';
import { useMemo } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import CollapsibleSection from './CollapsibleSection';
import useGetGuardianSetInfoByChain from '../hooks/useGetGuardianSetInfoByChain';

const coreBridgeChains = chains.filter((chain) => contracts.coreBridge.get('Mainnet', chain));

function CoreBridgeInfo({
  chain,
  address,
  guardianSetIndex,
  highestGuardianSetIndex,
}: {
  chain: Chain;
  address: string | undefined;
  guardianSetIndex: string | undefined;
  highestGuardianSetIndex: number;
}) {
  if (!address) return null;
  const idx = guardianSetIndex !== undefined ? Number(guardianSetIndex) : NaN;
  const behind = Number.isFinite(idx) && idx < highestGuardianSetIndex;
  return (
    <TableRow sx={behind ? { backgroundColor: 'rgba(100,0,0,.2)' } : undefined}>
      <TableCell>{chain}</TableCell>
      <TableCell>{chainToChainId(chain)}</TableCell>
      <TableCell>{address}</TableCell>
      <TableCell>{guardianSetIndex}</TableCell>
    </TableRow>
  );
}

function Contracts() {
  const { currentNetwork } = useNetworkContext();
  // const [guardianSetInfoByChain, setGuardianSetInfoByChain] = useState<GuardianSetInfoByChain>({});
  const guardianSetInfoByChain = useGetGuardianSetInfoByChain();
  const highestGuardianSetIndex = useMemo(
    () =>
      Math.max(
        ...Object.values(guardianSetInfoByChain).map((info) => Number(info.guardianSetIndex))
      ),
    [guardianSetInfoByChain]
  );

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
                  guardianSetIndex={guardianSetInfoByChain[chain]?.guardianSetIndex.toString()}
                  highestGuardianSetIndex={highestGuardianSetIndex}
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
