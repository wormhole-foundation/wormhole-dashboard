import {
  GridView,
  Link,
  MonitorHeartOutlined,
  PlayCircleOutline,
  ViewList,
} from '@mui/icons-material';
import {
  Box,
  Card,
  Divider,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { Heartbeat } from '../utils/getLastHeartbeats';
import CollapsibleSection from './CollapsibleSection';
import Table from './Table';
import TimeAgo from 'react-timeago';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import { isHeartbeatUnhealthy } from './Chains';

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
  }),
  //columnHelper.accessor("p2pNodeAddr", {
  //  header: () => "P2P Address",
  //}),
];

type HighestByChain = { [chainId: string]: bigint };

function GuardianCard({
  heartbeat,
  highestByChain,
}: {
  heartbeat: Heartbeat;
  highestByChain: HighestByChain;
}) {
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
  const healthyPercent = (healthyCount / chainCount) * 100;
  return (
    <Box width={260} m={1} height="100%">
      <Card sx={{ display: 'flex', p: 1, height: '100%', alignItems: 'center' }}>
        <Box flexBasis="100px" height="100%" textAlign="center">
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {heartbeat.nodeName}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Box flexGrow={1} my={-0.5}>
          <Tooltip
            title={`Last Heartbeat: ${
              heartbeat.timestamp
                ? new Date(Number(heartbeat.timestamp) / 1000000).toLocaleString()
                : null
            }`}
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
            title={`Boot Time: ${
              heartbeat.bootTimestamp
                ? new Date(Number(heartbeat.bootTimestamp) / 1000000).toLocaleString()
                : null
            }`}
          >
            <Box display="flex" alignItems="center" my={0.25}>
              <PlayCircleOutline fontSize="inherit" sx={{ mr: 0.5 }} />
              <Typography variant="caption">
                {heartbeat.bootTimestamp ? (
                  <TimeAgo date={Number(heartbeat.bootTimestamp) / 1000000} />
                ) : null}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title={`Healthy Chains: ${healthyCount} / ${chainCount}`}>
            <Box display="flex" alignItems="center" my={0.25}>
              <Link fontSize="inherit" sx={{ mr: 0.5 }} />
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
      </Card>
    </Box>
  );
}

type Displays = 'cards' | 'table';

function Guardians({
  heartbeats,
  chainIdsToHeartbeats,
}: {
  heartbeats: Heartbeat[];
  chainIdsToHeartbeats: ChainIdToHeartbeats;
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
    getRowId: (heartbeat) => heartbeat.guardianAddr,
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
          <Box pr={2}>Guardians</Box>
          <ToggleButtonGroup
            value={display}
            exclusive
            onChange={handleDisplay}
            size="small"
            sx={{ my: -1 }}
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
            <GuardianCard key={hb.guardianAddr} heartbeat={hb} highestByChain={highestByChain} />
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
