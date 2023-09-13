import { Heartbeat_Network } from '@certusone/wormhole-sdk-proto-web/lib/cjs/gossip/v1/gossip';
import {
  GridView,
  InfoOutlined,
  Link as LinkIcon,
  MonitorHeartOutlined,
  PlayCircleOutline,
  ViewList,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardActionArea,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Hidden,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  SxProps,
  Theme,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import TimeAgo from 'react-timeago';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import { Heartbeat } from '../utils/getLastHeartbeats';
import { isHeartbeatUnhealthy } from './Chains';
import CollapsibleSection from './CollapsibleSection';
import Table from './Table';
import chainIdToName from '../utils/chainIdToName';

const columnHelper = createColumnHelper<Heartbeat>();

const columns = [
  columnHelper.accessor('nodeName', {
    header: () => 'Guardian',
    sortingFn: `text`,
  }),
  columnHelper.accessor('version', {
    header: () => 'Version',
  }),
  columnHelper.accessor('features', {
    header: () => 'Features',
    cell: (info) => (info.getValue()?.length > 0 ? info.getValue().join(', ') : 'none'),
  }),
  columnHelper.accessor('counter', {
    header: () => 'Counter',
  }),
  columnHelper.accessor('bootTimestamp', {
    header: () => 'Boot',
    cell: (info) =>
      info.getValue() ? new Date(Number(info.getValue()) / 1000000).toLocaleString() : null,
  }),
  columnHelper.accessor('timestamp', {
    header: () => 'Timestamp',
    cell: (info) =>
      info.getValue() ? new Date(Number(info.getValue()) / 1000000).toLocaleString() : null,
  }),
  columnHelper.accessor('guardianAddr', {
    header: () => 'Address',
    cell: (info) => <code>{info.getValue()}</code>,
  }),
  columnHelper.accessor('p2pNodeAddr', {
    header: () => 'P2P Address',
    cell: (info) => <code>{info.getValue()}</code>,
  }),
];

type HighestByChain = { [chainId: string]: bigint };

const networkColumnHelper = createColumnHelper<Heartbeat_Network>();

const networkColumns = [
  networkColumnHelper.accessor('id', {
    header: () => 'Chain',
    cell: (info) => (
      <Typography variant="body2" noWrap>
        {chainIdToName(info.getValue())} ({info.getValue()})
      </Typography>
    ),
  }),
  networkColumnHelper.accessor('height', {
    header: () => 'Height',
  }),
  networkColumnHelper.accessor('contractAddress', {
    header: () => 'Contract',
  }),
];

function GuardianDetails({
  heartbeat,
  highestByChain,
  conditionalRowStyle,
}: {
  heartbeat: Heartbeat;
  highestByChain: HighestByChain;
  conditionalRowStyle?: ((a: Heartbeat_Network) => SxProps<Theme> | undefined) | undefined;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: false }]);
  console.log(sorting);
  const table = useReactTable({
    columns: networkColumns,
    data: heartbeat.networks,
    state: {
      sorting,
    },
    getRowId: (network) => network.id.toString(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  return <Table<Heartbeat_Network> table={table} conditionalRowStyle={conditionalRowStyle} />;
}

function GuardianCard({
  heartbeat,
  highestByChain,
  latestRelease,
}: {
  heartbeat: Heartbeat;
  highestByChain: HighestByChain;
  latestRelease: string | null;
}) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  const chainCount = Object.keys(highestByChain).length;
  const healthyCount = useMemo(
    () =>
      heartbeat.networks.reduce(
        (count, network) =>
          isHeartbeatUnhealthy(
            { guardian: heartbeat.guardianAddr, name: heartbeat.nodeName, network },
            highestByChain[network.id.toString()]
          )
            ? count
            : count + 1,
        0
      ),
    [heartbeat, highestByChain]
  );
  const conditionalRowStyle = useCallback(
    (network: Heartbeat_Network) =>
      isHeartbeatUnhealthy({ network, guardian: '', name: '' }, highestByChain[network.id])
        ? { backgroundColor: 'rgba(100,0,0,.2)' }
        : {},
    [highestByChain]
  );
  const healthyPercent = (healthyCount / chainCount) * 100;
  const hasLatestRelease = latestRelease && heartbeat.version !== latestRelease;
  return (
    <Box m={1} height="100%" sx={{ width: { sm: 232, xs: 142 } }}>
      <Card
        sx={{
          height: '100%',

          position: 'relative',
          overflow: 'visible',
        }}
      >
        <CardActionArea
          onClick={handleOpen}
          sx={{ display: 'flex', p: 1, height: '100%', alignItems: 'center' }}
        >
          <Hidden smDown>
            <Box flexBasis="72px" height="100%" textAlign="center">
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {heartbeat.nodeName.replace(/([a-w,y-z])([A-Z])/g, '$1 $2')}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          </Hidden>
          <Box flexGrow={1} my={-0.5}>
            <Hidden smUp>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {heartbeat.nodeName.replace(/([a-w,y-z])([A-Z])/g, '$1 $2')}
              </Typography>
            </Hidden>
            <Tooltip
              title={
                <Typography variant="body2">
                  Last Heartbeat:{' '}
                  {heartbeat.timestamp
                    ? new Date(Number(heartbeat.timestamp) / 1000000).toLocaleString()
                    : null}
                </Typography>
              }
            >
              <Box display="flex" alignItems="center" my={0.25}>
                <MonitorHeartOutlined fontSize="inherit" sx={{ mr: 0.5 }} />
                <Typography variant="caption">
                  {heartbeat.timestamp ? (
                    <TimeAgo date={Number(heartbeat.timestamp) / 1000000} />
                  ) : null}
                </Typography>
              </Box>
            </Tooltip>
            <Tooltip
              title={
                <>
                  <Typography variant="body2" gutterBottom>
                    Boot Time:{' '}
                    {heartbeat.bootTimestamp
                      ? new Date(Number(heartbeat.bootTimestamp) / 1000000).toLocaleString()
                      : null}
                  </Typography>
                  {hasLatestRelease ? (
                    <>
                      <Typography variant="body2" gutterBottom>
                        {heartbeat.nodeName} is not running the latest release.
                      </Typography>
                      <Typography variant="body2">Theirs: {heartbeat.version}</Typography>
                      <Typography variant="body2">Latest: {latestRelease}</Typography>
                    </>
                  ) : null}
                </>
              }
            >
              <Box display="flex" alignItems="center" my={0.25}>
                <PlayCircleOutline
                  color={hasLatestRelease ? 'primary' : 'inherit'}
                  fontSize="inherit"
                  sx={{ mr: 0.5 }}
                />
                <Typography variant="caption">
                  {heartbeat.bootTimestamp ? (
                    <TimeAgo date={Number(heartbeat.bootTimestamp) / 1000000} />
                  ) : null}
                </Typography>
              </Box>
            </Tooltip>
            <Tooltip
              title={
                <Typography variant="body2">
                  Healthy Chains: {healthyCount} / {chainCount}
                </Typography>
              }
            >
              <Box display="flex" alignItems="center" my={0.25}>
                <LinkIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                <LinearProgress
                  variant="determinate"
                  value={healthyPercent}
                  sx={{ flexGrow: 1 }}
                  color={
                    healthyPercent === 100 ? 'success' : healthyPercent > 80 ? 'warning' : 'error'
                  }
                />
              </Box>
            </Tooltip>
          </Box>
        </CardActionArea>
      </Card>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{heartbeat.nodeName}</DialogTitle>
        <DialogContent>
          <GuardianDetails
            heartbeat={heartbeat}
            highestByChain={highestByChain}
            conditionalRowStyle={conditionalRowStyle}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

type Displays = 'cards' | 'table';

function Guardians({
  heartbeats,
  chainIdsToHeartbeats,
  latestRelease,
}: {
  heartbeats: Heartbeat[];
  chainIdsToHeartbeats: ChainIdToHeartbeats;
  latestRelease: string | null;
}) {
  const highestByChain = useMemo(
    () =>
      Object.entries(chainIdsToHeartbeats).reduce((obj, [chainId, heartbeats]) => {
        let highest = BigInt(0);
        heartbeats.forEach((heartbeat) => {
          const height = BigInt(heartbeat.network.height);
          if (height > highest) {
            highest = height;
          }
        });
        obj[chainId] = highest;
        return obj;
      }, {} as HighestByChain),
    [chainIdsToHeartbeats]
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: heartbeats,
    state: {
      sorting,
    },
    getRowId: (heartbeat) => `${heartbeat.guardianAddr}-${heartbeat.nodeName}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  const [display, setDisplay] = useState<Displays>('cards');
  const handleDisplay = useCallback(
    (event: React.MouseEvent<HTMLElement>, newDisplay: Displays | null) => {
      if (newDisplay) {
        setDisplay(newDisplay);
      }
      event.stopPropagation();
    },
    []
  );
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
          <Box>Guardians</Box>
          <Tooltip
            title={
              <>
                <Typography variant="body1">
                  This section shows alerts for the following conditions:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <InfoOutlined color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Guardians not running the latest release"
                      secondary={
                        <>
                          The guardian version is compared to the latest release from{' '}
                          <Link
                            href="https://github.com/wormhole-foundation/wormhole/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            https://github.com/wormhole-foundation/wormhole/releases
                          </Link>
                        </>
                      }
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
          <ToggleButtonGroup
            value={display}
            exclusive
            onChange={handleDisplay}
            size="small"
            sx={{ my: -1, ml: 1 }}
          >
            <ToggleButton value="cards">
              <GridView fontSize="small" />
            </ToggleButton>
            <ToggleButton value="table">
              <ViewList fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Box flexGrow={1} />
        </Box>
      }
    >
      {display === 'cards' ? (
        <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent={'center'}>
          {heartbeats.map((hb) => (
            <GuardianCard
              key={`${hb.guardianAddr}-${hb.nodeName}`}
              heartbeat={hb}
              highestByChain={highestByChain}
              latestRelease={latestRelease}
            />
          ))}
        </Box>
      ) : (
        <Card>
          <Table<Heartbeat> table={table} showRowCount />
        </Card>
      )}
    </CollapsibleSection>
  );
}

export default Guardians;
