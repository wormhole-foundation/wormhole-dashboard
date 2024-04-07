import { Box, Card, IconButton } from '@mui/material';
import Table from './Table';
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
import { useTotalSupplyAndLocked } from '../hooks/useTotalSupplyAndLocked';
import { NTTTotalSupplyAndLockedData } from '@wormhole-foundation/wormhole-monitor-common';

const totalSupplyAndLockedColumnHelper = createColumnHelper<NTTTotalSupplyAndLockedData>();
const rateLimitColumns = [
  totalSupplyAndLockedColumnHelper.accessor('tokenName', {
    id: 'tokenName',
    header: () => 'Token',
    cell: (info) => <>{info.row.original.evmTotalSupply ? info.row.original.tokenName : null}</>,
  }),
  totalSupplyAndLockedColumnHelper.accessor((row) => row.chain, {
    id: 'srcChain',
    header: () => 'Chain',
    cell: (info) => (
      <>
        {info.row.getCanExpand() && info.row.original.evmTotalSupply ? (
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
          <Box sx={{ width: '20px' }} display="inline-block"></Box>
        )}{' '}
        {`${chainIdToName(info.row.original.chain)}(${info.row.original.chain})`}
      </>
    ),
  }),
  totalSupplyAndLockedColumnHelper.accessor('amountLocked', {
    header: () => <Box order="1">Locked</Box>,
    cell: (info) => (
      <Box textAlign="right">
        {info.row.original.evmTotalSupply ? info.row.original.amountLocked?.toLocaleString() : null}
      </Box>
    ),
  }),
  totalSupplyAndLockedColumnHelper.accessor('totalSupply', {
    header: () => <Box order="1">Total EVM Supply</Box>,
    cell: (info) => <Box textAlign="right">{info.row.original.totalSupply.toLocaleString()}</Box>,
  }),
];

export function NTTTotalSupplyAndLocked() {
  const network = useNetworkContext();
  const totalSupplyAndLocked = useTotalSupplyAndLocked(network.currentNetwork);
  const [totalSupplyAndLockedSorting, setTotalSupplyAndLockedSorting] = useState<SortingState>([]);
  const [totalSupplyAndLockedExpanded, setTotalSupplyAndLockedExpanded] = useState<ExpandedState>(
    {}
  );

  const table = useReactTable({
    columns: rateLimitColumns,
    data: totalSupplyAndLocked,
    state: {
      expanded: totalSupplyAndLockedExpanded,
      sorting: totalSupplyAndLockedSorting,
    },
    getSubRows: (row) => row.evmTotalSupply,
    getRowId: (totalSupplyAndLocked) =>
      `${totalSupplyAndLocked.tokenName}-${totalSupplyAndLocked.chain || ''}`,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setTotalSupplyAndLockedExpanded,
    onSortingChange: setTotalSupplyAndLockedSorting,
  });

  return (
    <Box mt={2} mx={2}>
      <Card>
        <Table<NTTTotalSupplyAndLockedData> table={table} />
      </Card>
    </Box>
  );
}
