import {
  ChainId,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_NEAR,
  CHAIN_ID_TERRA2,
  isCosmWasmChain,
  isEVMChain,
  tryHexToNativeAssetString,
  tryHexToNativeString,
} from '@certusone/wormhole-sdk';
import { GovernorGetEnqueuedVAAsResponse_Entry } from '@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc';
import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  LinearProgress,
  Link,
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
import numeral from 'numeral';
import React, { useMemo, useState } from 'react';
import {
  AvailableNotionalByChain,
  CloudGovernorInfo,
  GovernorToken,
} from '../hooks/useCloudGovernorInfo';
import useSymbolInfo from '../hooks/useSymbolInfo';
import chainIdToName from '../utils/chainIdToName';
import { CHAIN_INFO_MAP } from '../utils/consts';
import { explorerTx } from '../utils/explorer';
import CollapsibleSection from './CollapsibleSection';
import EnqueuedVAAChecker from './EnqueuedVAAChecker';
import Table from './Table';

const calculatePercent = (notional: AvailableNotionalByChain): number => {
  try {
    return (
      ((Number(notional.notionalLimit) - Number(notional.remainingAvailableNotional.jump)) /
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
  notionalColumnHelper.accessor('remainingAvailableNotional.min', {
    header: () => <Box order="1">Min Remaining</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional.avg', {
    header: () => <Box order="1">Avg Remaining</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0')}</Box>,
  }),
  notionalColumnHelper.accessor('remainingAvailableNotional.max', {
    header: () => <Box order="1">Max Remaining</Box>,
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
    cell: (info) => {
      const chain = info.row.original.emitterChain;
      const chainInfo = CHAIN_INFO_MAP[chain];
      if (!chainInfo) return info.getValue();
      var txHash: string = '';
      if (isCosmWasmChain(chainInfo.chainId)) {
        txHash = info.getValue().slice(2);
      } else if (!isEVMChain(chainInfo.chainId)) {
        try {
          txHash = tryHexToNativeString(info.getValue().slice(2), CHAIN_INFO_MAP[chain].chainId);
        } catch (e) {
          return info.getValue();
        }
      } else {
        txHash = info.getValue();
      }
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

interface GovernorToken_ext extends GovernorToken {
  symbol: string;
}

const tokenColumnHelper = createColumnHelper<GovernorToken_ext>();

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
        console.log(e);
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
  tokenColumnHelper.display({
    id: 'Symbol',
    header: () => 'Symbol',
    cell: (info) => `${info.row.original?.symbol}`,
  }),
  tokenColumnHelper.accessor('price', {
    header: () => <Box order="1">Price</Box>,
    cell: (info) => <Box textAlign="right">${numeral(info.getValue()).format('0,0.0000')}</Box>,
  }),
];

type ChainIdToEnqueuedCount = { [chainId: number]: number };

function MainnetGovernor({ governorInfo }: { governorInfo: CloudGovernorInfo }) {
  const tokenSymbols = useSymbolInfo(governorInfo.tokens);
  // TODO: governorInfo.tokens triggers updates to displayTokens, not tokenSymbols
  // Should fix this
  const displayTokens = useMemo(
    () =>
      governorInfo.tokens.map((tk) => ({
        ...tk,
        symbol: tokenSymbols.get([tk.originChainId, tk.originAddress].join('_'))?.symbol || '',
      })),
    [governorInfo.tokens, tokenSymbols]
  );

  const [notionalSorting, setNotionalSorting] = useState<SortingState>([]);
  const notionalTable = useReactTable({
    columns: notionalColumns,
    data: governorInfo.notionals,
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
    data: governorInfo.enqueuedVAAs,
    state: {
      sorting: enqueuedSorting,
    },
    getRowId: (vaa) => JSON.stringify(vaa),
    getCoreRowModel: getCoreRowModel(),
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
          {Object.keys(enqueuedByChain)
            .sort()
            .map((chainId) => (
              <React.Fragment key={chainId}>
                <Box
                  ml={2}
                  display="flex"
                  alignItems="center"
                  borderRadius="50%"
                  sx={{ p: 0.5, backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  {CHAIN_INFO_MAP[chainId]?.icon ? (
                    <img
                      src={CHAIN_INFO_MAP[chainId].icon}
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
              </React.Fragment>
            ))}
        </Box>
      }
    >
      <Box my={2}>
        <Card>
          <Table<GovernorGetEnqueuedVAAsResponse_Entry>
            table={enqueuedTable}
            showRowCount={!!governorInfo.enqueuedVAAs.length}
          />
          {governorInfo.enqueuedVAAs.length === 0 ? (
            <Typography variant="body2" sx={{ py: 1, textAlign: 'center' }}>
              No enqueued VAAs
            </Typography>
          ) : null}
        </Card>
      </Box>
      <Box mb={2}>
        <Card>
          <Table<AvailableNotionalByChain> table={notionalTable} />
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Tokens ({governorInfo.tokens.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<GovernorToken_ext> table={tokenTable} />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </CollapsibleSection>
  );
}
export default MainnetGovernor;
