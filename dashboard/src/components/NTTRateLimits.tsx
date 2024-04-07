import { Box, Card, IconButton } from '@mui/material';
import Table from './Table';
import { RateLimit } from '../utils/nttHelpers';
import { useRateLimits } from '../hooks/useRateLimits';
import {
  ExpandedState,
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { KeyboardArrowDown, KeyboardArrowRight } from '@mui/icons-material';
import { chainIdToName } from '@wormhole-foundation/wormhole-monitor-common';

const rateLimitColumnHelper = createColumnHelper<RateLimit>();

const rateLimitColumns = [
  rateLimitColumnHelper.accessor('tokenName', {
    id: 'tokenName',
    header: () => 'Token',
    cell: (info) => (
      <>
        {info.row.getCanExpand() && !info.row.original.srcChain ? (
          <IconButton
            size="small"
            sx={{ ml: -1 }}
            {...{
              onClick: info.row.getToggleExpandedHandler(),
            }}
          >
            {info.row.getIsExpanded() ? (
              <KeyboardArrowDown fontSize="inherit" />
            ) : (
              <KeyboardArrowRight fontSize="inherit" />
            )}
          </IconButton>
        ) : null}{' '}
        {info.row.original.srcChain
          ? info.row.original.destChain
            ? null
            : null
          : info.row.original.tokenName}
      </>
    ),
  }),
  rateLimitColumnHelper.accessor((row) => row.srcChain, {
    id: 'srcChain',
    header: () => 'Chain',
    cell: (info) => (
      <>
        {info.row.getCanExpand() && info.row.original.srcChain ? (
          <IconButton
            size="small"
            sx={{ ml: -1 }}
            {...{
              onClick: info.row.getToggleExpandedHandler(),
            }}
          >
            {info.row.getIsExpanded() ? (
              <KeyboardArrowDown fontSize="inherit" />
            ) : (
              <KeyboardArrowRight fontSize="inherit" />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 20, display: 'inline-block' }} />
        )}{' '}
        {info.row.original.srcChain
          ? info.row.original.destChain
            ? `${chainIdToName(info.row.original.destChain)}(${info.row.original.destChain})`
            : `${chainIdToName(info.row.original.srcChain)}(${info.row.original.srcChain})`
          : null}
      </>
    ),
  }),
  rateLimitColumnHelper.accessor('amount', {
    header: () => <Box order="1">Outbound Capacity</Box>,
    cell: (info) => (
      <Box textAlign="right">
        {info.row.original.srcChain
          ? info.row.original.destChain
            ? null
            : `${info.row.original.amount?.toLocaleString()}`
          : null}
      </Box>
    ),
  }),
  rateLimitColumnHelper.accessor('totalInboundCapacity', {
    header: () => <Box order="1">Inbound Capacity</Box>,
    cell: (info) => (
      <Box textAlign="right">
        {info.row.original.srcChain
          ? info.row.original.destChain
            ? info.row.original.amount?.toLocaleString()
            : `${info.row.original.totalInboundCapacity?.toLocaleString()}`
          : null}
      </Box>
    ),
  }),
];

export function NTTRateLimits() {
  const network = useNetworkContext();
  const rateLimits = useRateLimits(network.currentNetwork);
  const [rateLimitSorting, setRateLimitSorting] = useState<SortingState>([]);
  const [rateLimitExpanded, setRateLimitExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    columns: rateLimitColumns,
    data: rateLimits,
    state: {
      expanded: rateLimitExpanded,
      sorting: rateLimitSorting,
    },
    getSubRows: (row) => row.inboundCapacity,
    getRowId: (rateLimit) =>
      `${rateLimit.tokenName.toString()}-${rateLimit.srcChain || ''}-${rateLimit.destChain || ''}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setRateLimitExpanded,
    onSortingChange: setRateLimitSorting,
  });

  return (
    <Box mt={2} mx={2}>
      <Card>
        <Table<RateLimit> table={table} />
      </Card>
    </Box>
  );
}
