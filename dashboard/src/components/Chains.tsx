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
import { Environment, useCurrentEnvironment } from '../contexts/NetworkContext';
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
  conditionalRowStyle,
  environment,
}: {
  chainId: string;
  heartbeats: HeartbeatInfo[];
  healthyCount: number;
  conditionalRowStyle?: ((a: HeartbeatInfo) => SxProps<Theme> | undefined) | undefined;
  environment: Environment;
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
                {healthyCount} / {guardianHeartbeats.length}
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
                value={healthyCount === 0 ? 100 : (healthyCount / guardianHeartbeats.length) * 100}
                color={
                  healthyCount < getQuorumCount(environment)
                    ? 'error'
                    : healthyCount < getWarningCount(environment)
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
    conditionalRowStyle?: ((a: HeartbeatInfo) => SxProps<Theme> | undefined) | undefined;
  };
};

function Chains({ chainIdsToHeartbeats }: { chainIdsToHeartbeats: ChainIdToHeartbeats }) {
  const environment = useCurrentEnvironment();
  const {
    helpers,
    numSuccess,
    numWarnings,
    numErrors,
  }: {
    helpers: ChainHelpers;
    numSuccess: number;
    numWarnings: number;
    numErrors: number;
  } = useMemo(() => {
    let numSuccess = 0;
    let numWarnings = 0;
    let numErrors = 0;
    const helpers = Object.entries(chainIdsToHeartbeats).reduce((obj, [chainId, heartbeats]) => {
      let highest = BigInt(0);
      const filteredHeartbeats = heartbeats.filter(
        (hb) => !STANDBY_GUARDIANS.find((g) => g.pubkey.toLowerCase() === hb.guardian.toLowerCase())
      );
      filteredHeartbeats.forEach((heartbeat) => {
        const height = BigInt(heartbeat.network.height);
        if (height > highest) {
          highest = height;
        }
      });
      const conditionalRowStyle = (heartbeat: HeartbeatInfo) =>
        isHeartbeatUnhealthy(heartbeat, highest) ? { backgroundColor: 'rgba(100,0,0,.2)' } : {};
      const healthyCount = filteredHeartbeats.reduce(
        (count, heartbeat) => count + (isHeartbeatUnhealthy(heartbeat, highest) ? 0 : 1),
        0
      );
      if (healthyCount < getQuorumCount(environment)) {
        numErrors++;
      } else if (healthyCount < getWarningCount(environment)) {
        numWarnings++;
      } else {
        numSuccess++;
      }
      obj[chainId] = { healthyCount, conditionalRowStyle };
      return obj;
    }, {} as ChainHelpers);
    return {
      helpers,
      numSuccess,
      numWarnings,
      numErrors,
    };
  }, [chainIdsToHeartbeats, environment]);
  return (
    <CollapsibleSection
      header={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 1,
          }}
        >
          <Box>Chains</Box>
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
          {numSuccess > 0 ? (
            <>
              <CheckCircleOutline color="success" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numSuccess}
              </Typography>
            </>
          ) : null}
          {numWarnings > 0 ? (
            <>
              <WarningAmberOutlined color="warning" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numWarnings}
              </Typography>
            </>
          ) : null}
          {numErrors > 0 ? (
            <>
              <ErrorOutline color="error" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numErrors}
              </Typography>
            </>
          ) : null}
        </Box>
      }
    >
      <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent={'center'}>
        {Object.keys(chainIdsToHeartbeats).map((chainId) => (
          <Chain
            key={chainId}
            chainId={chainId}
            heartbeats={chainIdsToHeartbeats[Number(chainId)]}
            healthyCount={helpers[Number(chainId)].healthyCount}
            conditionalRowStyle={helpers[Number(chainId)].conditionalRowStyle}
            environment={environment}
          />
        ))}
      </Box>
    </CollapsibleSection>
  );
}

export default Chains;
