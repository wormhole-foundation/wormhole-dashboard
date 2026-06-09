import {
  Box,
  Card,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Chain, chainToChainId, chains, contracts } from '@wormhole-foundation/sdk-base';
import {
  chainIdToName,
  GUARDIAN_SET,
  STANDBY_GUARDIANS,
} from '@wormhole-foundation/wormhole-monitor-common';
import { useMemo } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import {
  DELEGATED_GUARDIAN_CONTRACT,
  DelegatedGuardianConfigMap,
} from '../hooks/useDelegatedGuardianConfig';
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

const guardianNameByPubkey: { [pubkey: string]: string } = [
  ...GUARDIAN_SET,
  ...STANDBY_GUARDIANS,
].reduce((map, g) => {
  map[g.pubkey.toLowerCase()] = g.name;
  return map;
}, {} as { [pubkey: string]: string });

function Contracts({ delegateConfig }: { delegateConfig: DelegatedGuardianConfigMap }) {
  const { currentNetwork } = useNetworkContext();
  const delegatedChainIds = useMemo(
    () =>
      Object.keys(delegateConfig)
        .map(Number)
        .sort((a, b) => a - b),
    [delegateConfig]
  );
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
    <>
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
      <CollapsibleSection header="Delegated Guardians">
        <Box sx={{ mb: 1, px: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Source:{' '}
            <Link
              href={`https://etherscan.io/address/${DELEGATED_GUARDIAN_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {DELEGATED_GUARDIAN_CONTRACT}
            </Link>{' '}
            (Ethereum)
          </Typography>
        </Box>
        {delegatedChainIds.length === 0 ? (
          <Box textAlign="center" my={4}>
            <Typography variant="body1" color="text.secondary">
              No delegated chains configured.
            </Typography>
          </Box>
        ) : (
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Chain Name</TableCell>
                    <TableCell>Chain ID</TableCell>
                    <TableCell>Quorum</TableCell>
                    <TableCell>Delegates</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delegatedChainIds.map((chainId) => {
                    const dc = delegateConfig[chainId];
                    return (
                      <TableRow key={chainId}>
                        <TableCell>{chainIdToName(chainId)}</TableCell>
                        <TableCell>{chainId}</TableCell>
                        <TableCell>
                          {dc.threshold} / {dc.numGuardians}
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 0.5 }}
                          >
                            {dc.keys.map((key) => (
                              <Box
                                key={key}
                                sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}
                              >
                                <Typography variant="body2" sx={{ minWidth: 140 }}>
                                  {guardianNameByPubkey[key] ?? 'Unknown'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="code"
                                  sx={{ color: 'text.secondary' }}
                                >
                                  {key}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
      </CollapsibleSection>
    </>
  ) : (
    <Box textAlign="center" my={8} mx={4}>
      <Typography variant="h3">Contract info is currently only supported in Mainnet</Typography>
    </Box>
  );
}

export default Contracts;
