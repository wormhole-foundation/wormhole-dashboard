import {
  GovernorGetAvailableNotionalByChainResponse_Entry,
  GovernorGetEnqueuedVAAsResponse_Entry,
  GovernorGetTokenListResponse_Entry,
} from '@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc';
import { ExpandMore, Search } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  InputAdornment,
  LinearProgress,
  Link,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import numeral from 'numeral';
import React, { useCallback, useMemo, useState } from 'react';
import useGovernorInfo from '../hooks/useGovernorInfo';
import chainIdToName from '../utils/chainIdToName';
import { CHAIN_INFO_MAP } from '@wormhole-foundation/wormhole-monitor-common';
import CollapsibleSection from './CollapsibleSection';
import EnqueuedVAAChecker from './EnqueuedVAAChecker';
import Table from './Table';
import { CHAIN_ICON_MAP } from '../utils/consts';
import { useCurrentEnvironment } from '../contexts/NetworkContext';
import { ExplorerTxHash } from './ExplorerTxHash';
import { ExplorerAssetURL } from './ExplorerAssetURL';

const calculatePercent = (notional: GovernorGetAvailableNotionalByChainResponse_Entry): number => {
  try {
    return (
      ((Number(notional.notionalLimit) - Number(notional.remainingAvailableNotional)) /
        Number(notional.notionalLimit)) *
      100
    );
  } catch (e) {
    return 0;
  }
};

interface NotionalWithHolds extends GovernorGetAvailableNotionalByChainResponse_Entry {
  held: bigint;
}

const notionalColumnHelper = createColumnHelper<NotionalWithHolds>();

const notionalColumns = [
  notionalColumnHelper.accessor('chainId', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
  }),
  notionalColumnHelper.accessor('notionalLimit', {
    header: () => <Box order="1">Limit</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('bigTransactionSize', {
    header: () => <Box order="1">Big Transaction</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional', {
    header: () => <Box order="1">Remaining</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('held', {
    header: () => <Box order="1">Withheld</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor(calculatePercent, {
    id: 'progress',
    header: () => 'Progress',
    cell: (info) => (
      <Tooltip title={`${info.getValue().toFixed(2)}%`} arrow>
        <LinearProgress
          variant="determinate"
          value={info.getValue()}
          color={info.getValue() > 80 ? 'error' : info.getValue() > 50 ? 'warning' : 'success'}
        />
      </Tooltip>
    ),
  }),
];

const enqueuedColumnHelper = createColumnHelper<GovernorGetEnqueuedVAAsResponse_Entry>();

const enqueuedColumns = [
  enqueuedColumnHelper.accessor('emitterChain', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  enqueuedColumnHelper.accessor('emitterAddress', {
    header: () => 'Emitter',
  }),
  enqueuedColumnHelper.accessor('sequence', {
    header: () => 'Sequence',
    cell: (info) => (
      <Link
        href={`https://wormhole-v2-mainnet-api.certus.one/v1/signed_vaa/${info.row.original.emitterChain}/${info.row.original.emitterAddress}/${info.row.original.sequence}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  enqueuedColumnHelper.display({
    id: 'hasQuorum',
    header: () => 'Has Quorum?',
    cell: (info) => <EnqueuedVAAChecker vaa={info.row.original} />,
  }),
  enqueuedColumnHelper.accessor('txHash', {
    header: () => 'Transaction Hash',
    cell: (info) => (
      <ExplorerTxHash chain={info.row.original.emitterChain} rawTxHash={info.getValue()} />
    ),
  }),
  enqueuedColumnHelper.accessor('releaseTime', {
    header: () => 'Release Time',
    cell: (info) => new Date(info.getValue() * 1000).toLocaleString(),
  }),
  enqueuedColumnHelper.accessor('notionalValue', {
    header: () => <Box order="1">Notional Value</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
];

const tokenColumnHelper = createColumnHelper<GovernorGetTokenListResponse_Entry>();

const tokenColumns = [
  tokenColumnHelper.accessor('originChainId', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
    enableGlobalFilter: false,
  }),
  tokenColumnHelper.accessor('originAddress', {
    header: () => 'Token',
    cell: (info) => (
      <ExplorerAssetURL chain={info.row.original.originChainId} assetAddr={info.getValue()} />
    ),
  }),
  tokenColumnHelper.accessor('price', {
    header: () => <Box order="1">Price</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0.0000')}</Box>,
    enableGlobalFilter: false,
  }),
];

type ChainIdToEnqueuedStats = {
  [chainId: number]: {
    count: number;
    notional: bigint;
  };
};

function Governor() {
  const governorInfo = useGovernorInfo();
  const displayTokens = useMemo(
    () =>
      governorInfo.tokens.map((tk) => ({
        ...tk,
      })),
    [governorInfo.tokens]
  );
  const enqueuedByChain = useMemo(
    () =>
      governorInfo.enqueued.reduce<ChainIdToEnqueuedStats>((counts, v) => {
        if (!counts[v.emitterChain]) {
          counts[v.emitterChain] = {
            count: 1,
            notional: BigInt(v.notionalValue),
          };
        } else {
          counts[v.emitterChain].count++;
          counts[v.emitterChain].notional += BigInt(v.notionalValue);
        }
        return counts;
      }, {}),
    [governorInfo.enqueued]
  );
  const notionalWithHolds = useMemo(
    () =>
      governorInfo.notionals.map<NotionalWithHolds>((n) => ({
        ...n,
        held: enqueuedByChain[n.chainId]?.notional || BigInt(0),
      })),
    [governorInfo.notionals, enqueuedByChain]
  );
  const [notionalSorting, setNotionalSorting] = useState<SortingState>([]);
  const notionalTable = useReactTable({
    columns: notionalColumns,
    data: notionalWithHolds,
    state: {
      sorting: notionalSorting,
    },
    getRowId: (notional) => notional.chainId.toString(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setNotionalSorting,
  });
  const [enqueuedSorting, setEnqueuedSorting] = useState<SortingState>([]);
  const enqueuedTable = useReactTable({
    columns: enqueuedColumns,
    data: governorInfo.enqueued,
    state: {
      sorting: enqueuedSorting,
    },
    getRowId: (vaa) => JSON.stringify(vaa),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setEnqueuedSorting,
  });
  const [tokenGlobalFilter, setTokenGlobalFilter] = useState('');
  const handleTokenGlobalFilterChange = useCallback((e: any) => {
    setTokenGlobalFilter(e.target.value);
  }, []);
  const [tokenSorting, setTokenSorting] = useState<SortingState>([]);
  const tokenTable = useReactTable({
    columns: tokenColumns,
    data: displayTokens,
    state: {
      globalFilter: tokenGlobalFilter,
      sorting: tokenSorting,
    },
    getRowId: (token) => `${token.originChainId}_${token.originAddress}`,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setTokenGlobalFilter,
    onSortingChange: setTokenSorting,
  });
  const network = useCurrentEnvironment();
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
          <Box>Governor</Box>
          <Box flexGrow={1} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.keys(enqueuedByChain)
              .sort()
              .map((chainId) => (
                <Box key={chainId} display="flex" alignItems="center">
                  <Box
                    ml={2}
                    display="flex"
                    alignItems="center"
                    borderRadius="50%"
                    sx={{ p: 0.5, backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    {CHAIN_ICON_MAP[chainId] ? (
                      <img
                        src={CHAIN_ICON_MAP[chainId]}
                        alt={CHAIN_INFO_MAP[network][chainId].name}
                        width={24}
                        height={24}
                      />
                    ) : (
                      <Typography variant="body2">{chainId}</Typography>
                    )}
                  </Box>
                  <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                    {enqueuedByChain[Number(chainId)].count}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Box>
      }
    >
      <Box mb={2}>
        <Card>
          <Table<NotionalWithHolds> table={notionalTable} />
        </Card>
      </Box>
      <Box my={2}>
        <Card>
          <Table<GovernorGetEnqueuedVAAsResponse_Entry>
            table={enqueuedTable}
            paginated={!!governorInfo.enqueued.length}
            showRowCount={!!governorInfo.enqueued.length}
          />
          {governorInfo.enqueued.length === 0 ? (
            <Typography variant="body2" sx={{ py: 1, textAlign: 'center' }}>
              No enqueued VAAs
            </Typography>
          ) : null}
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Tokens ({governorInfo.tokens.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                type="search"
                value={tokenGlobalFilter}
                onChange={handleTokenGlobalFilterChange}
                margin="dense"
                size="small"
                sx={{ mb: 1, ml: 1.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                placeholder="Search Address"
              />
              <Table<GovernorGetTokenListResponse_Entry> table={tokenTable} />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </CollapsibleSection>
  );
}
export default Governor;
