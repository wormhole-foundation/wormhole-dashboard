import {
  CHAIN_ID_ALGORAND,
  CHAIN_ID_NEAR,
  CHAIN_ID_TERRA2,
  ChainId,
  tryHexToNativeAssetString,
} from '@certusone/wormhole-sdk';
import {
  ExpandMore,
  KeyboardArrowDown,
  KeyboardArrowRight,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  IconButton,
  LinearProgress,
  Link,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ExpandedState,
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import numeral from 'numeral';
import React, { useMemo, useState } from 'react';
import {
  AvailableNotionalByChain,
  CloudGovernorInfo,
  EnqueuedVAA,
  GovernorToken,
} from '../hooks/useCloudGovernorInfo';
import chainIdToName from '../utils/chainIdToName';
import { CHAIN_ICON_MAP, GUARDIAN_SET_3 } from '../utils/consts';
import {
  CHAIN_INFO_MAP,
  explorerTx,
  getExplorerTxHash,
} from '@wormhole-foundation/wormhole-monitor-common';
import CollapsibleSection from './CollapsibleSection';
import EnqueuedVAAChecker from './EnqueuedVAAChecker';
import Table from './Table';

const calculatePercent = (notional: AvailableNotionalByChain): number => {
  try {
    return (
      ((Number(notional.notionalLimit) - Number(notional.remainingAvailableNotional.quorum)) /
        Number(notional.notionalLimit)) *
      100
    );
  } catch (e) {
    return 0;
  }
};

const notionalColumnHelper = createColumnHelper<AvailableNotionalByChain>();

const notionalColumns = [
  notionalColumnHelper.accessor('chainId', {
    header: () => 'Chain',
    cell: (info) => (
      <>
        {info.row.getCanExpand() ? (
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
        {info.row.original.guardianName ? (
          <Box sx={{ pl: 3 }}>{info.row.original.guardianName}</Box>
        ) : (
          `${chainIdToName(info.getValue())} (${info.getValue()})`
        )}
      </>
    ),
  }),
  notionalColumnHelper.accessor('notionalLimit', {
    header: () => <Box order="1">Limit</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('bigTransactionSize', {
    header: () => <Box order="1">Big Transaction</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional.min', {
    header: () => <Box order="1">Min Remaining</Box>,
    cell: (info) =>
      info.row.original.guardianName ? null : (
        <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>
      ),
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional.quorum', {
    header: () => <Box order="1">Quorum Remaining</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional.max', {
    header: () => <Box order="1">Max Remaining</Box>,
    cell: (info) =>
      info.row.original.guardianName ? null : (
        <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>
      ),
  }),
  notionalColumnHelper.accessor(calculatePercent, {
    id: 'progress',
    header: () => 'Percent',
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

type GuardianHoldingStat = {
  name: string;
  numHeld: number;
  byChain: { [chainId: number]: number };
};

const guardianHoldingColumnHelper = createColumnHelper<GuardianHoldingStat>();

const guardianHoldingColumns = [
  guardianHoldingColumnHelper.accessor('name', {
    header: () => 'Guardian',
    sortingFn: `text`,
  }),
  guardianHoldingColumnHelper.accessor('numHeld', {
    header: () => <Box order="1">Total Held</Box>,
    cell: (info) => <Box textAlign="right">{info.getValue()}</Box>,
  }),
  guardianHoldingColumnHelper.accessor('byChain', {
    header: () => <Box order="1">By Chain</Box>,
    cell: (info) => (
      <Box display="flex" alignItems="center" justifyContent="flex-end">
        {Object.entries(info.getValue())
          .filter(([chainId, num]) => num !== 0)
          .map(([chainId, number]) => (
            <React.Fragment key={chainId}>
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
                    alt={CHAIN_INFO_MAP[chainId].name}
                    width={12}
                    height={12}
                  />
                ) : (
                  <Typography variant="body2">{chainId}</Typography>
                )}
              </Box>
              <Box sx={{ ml: 0.5 }}>{number}</Box>
            </React.Fragment>
          ))}
      </Box>
    ),
  }),
];

const enqueuedColumnHelper = createColumnHelper<EnqueuedVAA>();

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
  enqueuedColumnHelper.display({
    id: 'numGuardians',
    header: () => 'Num Holding',
    cell: (info) => Object.keys(info.row.original.byGuardian).length,
  }),
  enqueuedColumnHelper.accessor('txHash', {
    header: () => 'Transaction Hash',
    cell: (info) => {
      const chain = info.row.original.emitterChain;
      const chainInfo = CHAIN_INFO_MAP[chain];
      if (!chainInfo) return info.getValue();
      const txHash = getExplorerTxHash(chainInfo.chainId, info.getValue());
      return (
        <Link
          href={explorerTx(chainInfo.chainId, txHash)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {txHash}
        </Link>
      );
    },
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

const tokenColumnHelper = createColumnHelper<GovernorToken>();

const tokenColumns = [
  tokenColumnHelper.accessor('originChainId', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  tokenColumnHelper.accessor('originAddress', {
    header: () => 'Token',
    cell: (info) => {
      const chain = info.row.original.originChainId;
      const chainInfo = CHAIN_INFO_MAP[chain];
      if (!chainInfo) return info.getValue();
      const chainId: ChainId = chainInfo.chainId;
      var tokenAddress: string = '';
      if (
        chainId === CHAIN_ID_ALGORAND ||
        chainId === CHAIN_ID_NEAR ||
        chainId === CHAIN_ID_TERRA2
      ) {
        return info.getValue();
      }
      try {
        tokenAddress = tryHexToNativeAssetString(
          info.getValue().slice(2),
          CHAIN_INFO_MAP[chain]?.chainId
        );
      } catch (e) {
        tokenAddress = info.getValue();
      }

      const explorerString = chainInfo?.explorerStem;
      const url = `${explorerString}/address/${tokenAddress}`;
      return (
        <Link href={url} target="_blank" rel="noopener noreferrer">
          {tokenAddress}
        </Link>
      );
    },
  }),
  tokenColumnHelper.accessor('price', {
    header: () => <Box order="1">Price</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0.0000')}</Box>,
  }),
];

type ChainIdToEnqueuedCount = { [chainId: number]: number };

function MainnetGovernor({ governorInfo }: { governorInfo: CloudGovernorInfo }) {
  const displayTokens = useMemo(
    () =>
      governorInfo.tokens.map((tk) => ({
        ...tk,
        // TODO: get token symbols from DB
      })),
    [governorInfo.tokens]
  );

  const [notionalSorting, setNotionalSorting] = useState<SortingState>([]);
  const [notionalExpanded, setNotionalExpanded] = useState<ExpandedState>({});
  const notionalTable = useReactTable({
    columns: notionalColumns,
    data: governorInfo.notionals,
    state: {
      expanded: notionalExpanded,
      sorting: notionalSorting,
    },
    getRowId: (notional) => `${notional.chainId.toString()}-${notional.guardianName || ''}`,
    getSubRows: (row) => row.byGuardian,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setNotionalExpanded,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setNotionalSorting,
  });
  const guardianHoldingStats: GuardianHoldingStat[] = useMemo(() => {
    const stats: GuardianHoldingStat[] = GUARDIAN_SET_3.map((g) => ({
      name: g.name,
      numHeld: 0,
      byChain: {},
    }));
    for (const gPub of Object.keys(governorInfo.totalEnqueuedVaas)) {
      const idx = GUARDIAN_SET_3.findIndex(
        (g) => `0x${gPub}`.toLowerCase() === g.pubkey.toLowerCase()
      );
      if (idx !== -1) {
        stats[idx].byChain = governorInfo.totalEnqueuedVaas[gPub];
        stats[idx].numHeld += Object.values(governorInfo.totalEnqueuedVaas[gPub]).reduce(
          (s, n) => s + n,
          0
        );
      }
    }
    return stats;
  }, [governorInfo.totalEnqueuedVaas]);
  const [guardianHoldingSorting, setGuardianHoldingSorting] = useState<SortingState>([]);
  const guardianHolding = useReactTable({
    columns: guardianHoldingColumns,
    data: guardianHoldingStats,
    state: {
      sorting: guardianHoldingSorting,
    },
    getRowId: (key) => JSON.stringify(key),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setGuardianHoldingSorting,
  });
  const [enqueuedSorting, setEnqueuedSorting] = useState<SortingState>([]);
  const enqueuedTable = useReactTable({
    columns: enqueuedColumns,
    data: governorInfo.enqueuedVAAs,
    state: {
      sorting: enqueuedSorting,
    },
    getRowId: (vaa) => JSON.stringify(vaa),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setEnqueuedSorting,
  });
  const [tokenSorting, setTokenSorting] = useState<SortingState>([]);
  const tokenTable = useReactTable({
    columns: tokenColumns,
    data: displayTokens,
    state: {
      sorting: tokenSorting,
    },
    getRowId: (token) => `${token.originChainId}_${token.originAddress}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setTokenSorting,
  });
  const enqueuedByChain: ChainIdToEnqueuedCount = useMemo(
    () =>
      governorInfo.enqueuedVAAs.reduce((counts, v) => {
        if (!counts[v.emitterChain]) {
          counts[v.emitterChain] = 1;
        } else {
          counts[v.emitterChain]++;
        }
        return counts;
      }, {} as ChainIdToEnqueuedCount),
    [governorInfo.enqueuedVAAs]
  );
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
                        alt={CHAIN_INFO_MAP[chainId].name}
                        width={24}
                        height={24}
                      />
                    ) : (
                      <Typography variant="body2">{chainId}</Typography>
                    )}
                  </Box>
                  <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                    {enqueuedByChain[Number(chainId)]}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Box>
      }
    >
      <Box mb={2}>
        <Card>
          <Table<AvailableNotionalByChain> table={notionalTable} />
        </Card>
      </Box>
      {governorInfo.enqueuedVAAs.length ? (
        <Box mb={2}>
          <Card>
            <Table<GuardianHoldingStat> table={guardianHolding} />
          </Card>
        </Box>
      ) : null}
      <Box my={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography display="flex" alignItems="center">
                Transactions ({governorInfo.enqueuedVAAs.length}){' '}
                <Tooltip title="Please note: Each guardian only gossips 20 of its enqueued VAAs. If the numbers above are larger than that, only a subset of the held transactions may be shown">
                  <WarningAmberOutlined sx={{ fontSize: '1em', ml: 0.5 }} />
                </Tooltip>
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<EnqueuedVAA>
                table={enqueuedTable}
                paginated={!!governorInfo.enqueuedVAAs.length}
                showRowCount={!!governorInfo.enqueuedVAAs.length}
              />
              {governorInfo.enqueuedVAAs.length === 0 ? (
                <Typography variant="body2" sx={{ py: 1, textAlign: 'center' }}>
                  No enqueued VAAs
                </Typography>
              ) : null}
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Tokens ({governorInfo.tokens.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<GovernorToken> table={tokenTable} />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </CollapsibleSection>
  );
}
export default MainnetGovernor;
