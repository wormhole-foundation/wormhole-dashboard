import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  SxProps,
  Theme,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { chainIdToName, STANDBY_GUARDIANS } from '@wormhole-foundation/wormhole-monitor-common';
import { useCallback, useMemo, useState } from 'react';
import { useDelegatedGuardiansContext } from '../contexts/DelegatedGuardiansContext';
import { useCurrentEnvironment } from '../contexts/NetworkContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { ChainIdToHeartbeats, HeartbeatInfo } from '../hooks/useChainHeartbeats';
import { CHAIN_ICON_MAP } from '../utils/consts';
import {
  BEHIND_DIFF,
  CHAIN_LESS_THAN_MAX_WARNING_THRESHOLD,
  getBehindDiffForChain,
  getQuorumCount,
  getWarningCount,
} from './Alerts';
import CollapsibleSection from './CollapsibleSection';
import Table from './Table';

const columnHelper = createColumnHelper<HeartbeatInfo>();

const columns = [
  columnHelper.accessor('name', {
    header: () => 'Guardian',
    cell: (info) => (
      <Typography variant="body2" noWrap>
        {info.getValue()}
      </Typography>
    ),
    sortingFn: `text`,
  }),
  columnHelper.accessor('network.height', {
    header: () => 'Latest',
  }),
  columnHelper.accessor('network.safeHeight', {
    header: () => 'Safe',
  }),
  columnHelper.accessor('network.finalizedHeight', {
    header: () => 'Finalized',
  }),
  columnHelper.accessor('network.contractAddress', {
    header: () => 'Contract',
  }),
];

function ChainDetails({
  heartbeats,
  conditionalRowStyle,
}: {
  heartbeats: HeartbeatInfo[];
  conditionalRowStyle?: ((a: HeartbeatInfo) => SxProps<Theme> | undefined) | undefined;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: heartbeats,
    state: {
      sorting,
    },
    getRowId: (heartbeat) => heartbeat.guardian,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  return <Table<HeartbeatInfo> table={table} conditionalRowStyle={conditionalRowStyle} />;
}

export const isHeartbeatUnhealthy = (heartbeat: HeartbeatInfo, highest: bigint) =>
  heartbeat.network.height === '0' ||
  highest - BigInt(heartbeat.network.height) > BigInt(getBehindDiffForChain(heartbeat.network.id));

function Chain({
  chainId,
  heartbeats,
  healthyCount,
  totalGuardians,
  quorumThreshold,
  warningThreshold,
  conditionalRowStyle,
}: {
  chainId: string;
  heartbeats: HeartbeatInfo[];
  healthyCount: number;
  totalGuardians: number;
  quorumThreshold: number;
  warningThreshold: number;
  conditionalRowStyle?: ((a: HeartbeatInfo) => SxProps<Theme> | undefined) | undefined;
}) {
  const [guardianHeartbeats, standbyHeartbeats] = useMemo(
    () =>
      heartbeats.reduce(
        ([guardian, standby], hb) => {
          if (STANDBY_GUARDIANS.find((g) => g.pubkey.toLowerCase() === hb.guardian.toLowerCase())) {
            return [guardian, [...standby, hb]];
          }
          return [[...guardian, hb], standby];
        },
        [[] as HeartbeatInfo[], [] as HeartbeatInfo[]]
      ),
    [heartbeats]
  );
  const smUp = useMediaQuery((theme: any) => theme.breakpoints.up('sm'));
  const {
    settings: { showChainName },
  } = useSettingsContext();
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <Box my={smUp ? 2 : 0.25} mx={1} textAlign={'center'}>
        <Tooltip
          title={
            <Box textAlign="center">
              <Typography>
                {chainIdToName(Number(chainId))} ({chainId})
              </Typography>
              <Typography>
                {healthyCount} / {totalGuardians}
              </Typography>
            </Box>
          }
        >
          <Button
            onClick={handleOpen}
            sx={{
              borderRadius: showChainName ? undefined : '50%',
              flexDirection: 'column',
              minWidth: showChainName ? '102px' : { xs: '59px', sm: '86px' },
              maxWidth: showChainName ? '102px' : { xs: '59px', sm: '86px' },
              textTransform: 'none',
            }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={healthyCount === 0 ? 100 : (healthyCount / totalGuardians) * 100}
                color={
                  healthyCount < quorumThreshold
                    ? 'error'
                    : healthyCount < warningThreshold
                    ? 'warning'
                    : 'success'
                }
                thickness={smUp ? 6 : 4}
                size={smUp ? 74 : 47}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography component="div" color="text.secondary">
                  {CHAIN_ICON_MAP[chainId] ? (
                    <Box
                      sx={{
                        borderRadius: '50%',
                        display: 'flex',
                        p: 1.25,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        '& > img': {
                          width: { xs: 20, sm: 34 },
                          height: { xs: 20, sm: 34 },
                        },
                      }}
                    >
                      <img src={CHAIN_ICON_MAP[chainId]} alt={chainId} />
                    </Box>
                  ) : (
                    chainId
                  )}
                </Typography>
              </Box>
            </Box>
            {showChainName ? (
              <Chip sx={{ mt: 1.5 }} label={chainIdToName(Number(chainId))} size="small" />
            ) : null}
          </Button>
        </Tooltip>
      </Box>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {chainIdToName(Number(chainId))} ({chainId})
        </DialogTitle>
        <DialogContent>
          <ChainDetails heartbeats={guardianHeartbeats} conditionalRowStyle={conditionalRowStyle} />
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            Standby Guardians
          </Typography>
          <ChainDetails heartbeats={standbyHeartbeats} conditionalRowStyle={conditionalRowStyle} />
        </DialogContent>
      </Dialog>
    </>
  );
}

type ChainHelpers = {
  [chainId: string]: {
    healthyCount: number;
    totalGuardians: number;
    quorumThreshold: number;
    warningThreshold: number;
    conditionalRowStyle?: ((a: HeartbeatInfo) => SxProps<Theme> | undefined) | undefined;
  };
};

type ChainStats = {
  numSuccess: number;
  numWarnings: number;
  numErrors: number;
};

function ChainSectionHeader({
  title,
  stats,
}: {
  title: string;
  stats: ChainStats;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        paddingRight: 1,
      }}
    >
      <Box>{title}</Box>
      <Tooltip
        title={
          <>
            <Typography variant="body1">
              This section shows alerts for the following conditions:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <ErrorOutline color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Chains with a quorum of guardians down"
                  secondary={`A guardian is considered down if it is
                  reporting a height of 0, more than ${BEHIND_DIFF} behind the highest height, or missing from the list of
                  heartbeats`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WarningAmberOutlined color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={`Chains with ${CHAIN_LESS_THAN_MAX_WARNING_THRESHOLD} or more guardians down`}
                  secondary={`A guardian is considered down if it is
                  reporting a height of 0, more than ${BEHIND_DIFF} behind the highest height, or missing from the list of
                  heartbeats`}
                />
              </ListItem>
            </List>
          </>
        }
        componentsProps={{ tooltip: { sx: { maxWidth: '100%' } } }}
      >
        <Box>
          <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
        </Box>
      </Tooltip>
      <Box flexGrow={1} />
      {stats.numSuccess > 0 ? (
        <>
          <CheckCircleOutline color="success" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {stats.numSuccess}
          </Typography>
        </>
      ) : null}
      {stats.numWarnings > 0 ? (
        <>
          <WarningAmberOutlined color="warning" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {stats.numWarnings}
          </Typography>
        </>
      ) : null}
      {stats.numErrors > 0 ? (
        <>
          <ErrorOutline color="error" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {stats.numErrors}
          </Typography>
        </>
      ) : null}
    </Box>
  );
}

function Chains({ chainIdsToHeartbeats }: { chainIdsToHeartbeats: ChainIdToHeartbeats }) {
  const environment = useCurrentEnvironment();
  const { config: delegatedGuardiansConfig } = useDelegatedGuardiansContext();

  const {
    helpers,
    delegatedChainIds,
    nonDelegatedChainIds,
    delegatedStats,
    nonDelegatedStats,
  }: {
    helpers: ChainHelpers;
    delegatedChainIds: string[];
    nonDelegatedChainIds: string[];
    delegatedStats: ChainStats;
    nonDelegatedStats: ChainStats;
  } = useMemo(() => {
    const delegatedStats: ChainStats = { numSuccess: 0, numWarnings: 0, numErrors: 0 };
    const nonDelegatedStats: ChainStats = { numSuccess: 0, numWarnings: 0, numErrors: 0 };
    const delegatedChainIds: string[] = [];
    const nonDelegatedChainIds: string[] = [];

    const helpers = Object.entries(chainIdsToHeartbeats).reduce((obj, [chainId, heartbeats]) => {
      const isDelegated = Number(chainId) in delegatedGuardiansConfig;
      const delegatedConfig = isDelegated ? delegatedGuardiansConfig[Number(chainId)] : null;

      // Build delegated keys set once (used for filtering and row styling)
      const delegatedKeysSet = delegatedConfig
        ? new Set(delegatedConfig.keys.map((k) => k.toLowerCase()))
        : null;

      // For delegated chains, only consider guardians in the delegated keys
      // For regular chains, filter out standby guardians
      let relevantHeartbeats: HeartbeatInfo[];
      if (delegatedKeysSet) {
        relevantHeartbeats = heartbeats.filter((hb) =>
          delegatedKeysSet.has(hb.guardian.toLowerCase())
        );
      } else {
        relevantHeartbeats = heartbeats.filter(
          (hb) =>
            !STANDBY_GUARDIANS.find((g) => g.pubkey.toLowerCase() === hb.guardian.toLowerCase())
        );
      }

      // Find the highest block height among relevant guardians
      let highest = BigInt(0);
      relevantHeartbeats.forEach((heartbeat) => {
        const height = BigInt(heartbeat.network.height);
        if (height > highest) {
          highest = height;
        }
      });

      // For delegated chains: RED if unhealthy and should be listening, YELLOW if unhealthy but not expected to listen
      // For regular chains: RED if unhealthy
      const conditionalRowStyle = (heartbeat: HeartbeatInfo) => {
        if (!isHeartbeatUnhealthy(heartbeat, highest)) {
          return {};
        }
        // Unhealthy guardian
        if (delegatedKeysSet) {
          // Delegated chain: check if this guardian is expected to listen
          const isExpectedToListen = delegatedKeysSet.has(heartbeat.guardian.toLowerCase());
          return isExpectedToListen
            ? { backgroundColor: 'rgba(100,0,0,.2)' } // RED - should be listening but isn't
            : { backgroundColor: 'rgba(100,100,0,.2)' }; // YELLOW - not expected to listen
        }
        // Regular chain: all guardians should be listening
        return { backgroundColor: 'rgba(100,0,0,.2)' };
      };

      const healthyCount = relevantHeartbeats.reduce(
        (count, heartbeat) => count + (isHeartbeatUnhealthy(heartbeat, highest) ? 0 : 1),
        0
      );

      // Determine thresholds based on whether chain is delegated
      let totalGuardians: number;
      let quorumThreshold: number;
      let warningThreshold: number;

      if (delegatedConfig) {
        totalGuardians = delegatedConfig.keys.length;
        quorumThreshold = delegatedConfig.threshold;
        // Warning when not all delegated guardians are healthy
        warningThreshold = totalGuardians;
      } else {
        totalGuardians = relevantHeartbeats.length;
        quorumThreshold = getQuorumCount(environment);
        warningThreshold = getWarningCount(environment);
      }

      const stats = isDelegated ? delegatedStats : nonDelegatedStats;

      if (isDelegated) {
        delegatedChainIds.push(chainId);
      } else {
        nonDelegatedChainIds.push(chainId);
      }

      if (healthyCount < quorumThreshold) {
        stats.numErrors++;
      } else if (healthyCount < warningThreshold) {
        stats.numWarnings++;
      } else {
        stats.numSuccess++;
      }
      obj[chainId] = {
        healthyCount,
        totalGuardians,
        quorumThreshold,
        warningThreshold,
        conditionalRowStyle,
      };
      return obj;
    }, {} as ChainHelpers);
    return {
      helpers,
      delegatedChainIds,
      nonDelegatedChainIds,
      delegatedStats,
      nonDelegatedStats,
    };
  }, [chainIdsToHeartbeats, environment, delegatedGuardiansConfig]);

  return (
    <>
      {nonDelegatedChainIds.length > 0 && (
        <CollapsibleSection
          header={<ChainSectionHeader title="Chains" stats={nonDelegatedStats} />}
        >
          <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent={'center'}>
            {nonDelegatedChainIds.map((chainId) => (
              <Chain
                key={chainId}
                chainId={chainId}
                heartbeats={chainIdsToHeartbeats[Number(chainId)]}
                healthyCount={helpers[Number(chainId)].healthyCount}
                totalGuardians={helpers[Number(chainId)].totalGuardians}
                quorumThreshold={helpers[Number(chainId)].quorumThreshold}
                warningThreshold={helpers[Number(chainId)].warningThreshold}
                conditionalRowStyle={helpers[Number(chainId)].conditionalRowStyle}
              />
            ))}
          </Box>
        </CollapsibleSection>
      )}
      {delegatedChainIds.length > 0 && (
        <CollapsibleSection
          header={<ChainSectionHeader title="Delegated Chains" stats={delegatedStats} />}
        >
          <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent={'center'}>
            {delegatedChainIds.map((chainId) => (
              <Chain
                key={chainId}
                chainId={chainId}
                heartbeats={chainIdsToHeartbeats[Number(chainId)]}
                healthyCount={helpers[Number(chainId)].healthyCount}
                totalGuardians={helpers[Number(chainId)].totalGuardians}
                quorumThreshold={helpers[Number(chainId)].quorumThreshold}
                warningThreshold={helpers[Number(chainId)].warningThreshold}
                conditionalRowStyle={helpers[Number(chainId)].conditionalRowStyle}
              />
            ))}
          </Box>
        </CollapsibleSection>
      )}

    </>
  );
}

export default Chains;
