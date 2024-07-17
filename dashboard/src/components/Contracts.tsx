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
import { useNetworkContext } from '../contexts/NetworkContext';
import CollapsibleSection from './CollapsibleSection';
import useGetGuardianSetInfoByChain from '../hooks/useGetGuardianSetInfoByChain';

const coreBridgeChains = chains.filter(
  (chain) => chain !== 'Aurora' && contracts.coreBridge.get('Mainnet', chain)
);

function CoreBridgeInfo({
  chain,
  address,
  guardianSetIndex,
}: {
  chain: Chain;
  address: string | undefined;
  guardianSetIndex: string | undefined;
}) {
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
  // const [guardianSetInfoByChain, setGuardianSetInfoByChain] = useState<GuardianSetInfoByChain>({});
  const guardianSetInfoByChain = useGetGuardianSetInfoByChain();

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
