import { Box, Card, IconButton } from '@mui/material';
import Table from './Table';
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
import { NTTRateLimit, chainIdToName } from '@wormhole-foundation/wormhole-monitor-common';
import CollapsibleSection from './CollapsibleSection';
import { normalizeBigNumber } from '../utils/normalizeBigNumber';

const rateLimitColumnHelper = createColumnHelper<NTTRateLimit>();

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
          ? `${chainIdToName(info.row.original.srcChain)}(${info.row.original.srcChain})`
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
            : info.row.original.amount
            ? `${normalizeBigNumber(info.row.original.amount, 2)}`
            : null
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
            ? `${normalizeBigNumber(info.row.original.amount, 2)}`
            : `${normalizeBigNumber(info.row.original.totalInboundCapacity, 2)}`
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
      `${rateLimit.tokenName}-${rateLimit.srcChain || ''}-${rateLimit.destChain || ''}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setRateLimitExpanded,
    onSortingChange: setRateLimitSorting,
  });

  return (
    <CollapsibleSection
      defaultExpanded={false}
      header={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 1,
          }}
        >
          <Box>Rate Limit Capacity</Box>
        </Box>
      }
    >
      <Box mt={2} mx={2}>
        <Card>
          <Table<NTTRateLimit> table={table} />
        </Card>
      </Box>
    </CollapsibleSection>
  );
}
