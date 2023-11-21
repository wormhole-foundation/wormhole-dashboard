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
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { CloudGovernorInfo } from '../hooks/useCloudGovernorInfo';
import useGetAccountantAccounts, { Account } from '../hooks/useGetAccountantAccounts';
import useGetAccountantPendingTransfers, {
  PendingTransfer,
} from '../hooks/useGetAccountantPendingTransfers';
import chainIdToName from '../utils/chainIdToName';
import { CHAIN_ICON_MAP, GUARDIAN_SET_3 } from '../utils/consts';
import {
  CHAIN_INFO_MAP,
  explorerTx,
  getExplorerTxHash,
} from '@wormhole-foundation/wormhole-monitor-common';
import CollapsibleSection from './CollapsibleSection';
import Table from './Table';
import useTokenData, { TokenDataEntry } from '../hooks/useTokenData';
import numeral from 'numeral';

type PendingTransferForAcct = PendingTransfer & { isEnqueuedInGov: boolean };
type AccountWithTokenData = Account & {
  tokenData?: TokenDataEntry;
  tvlTvm: number;
  adjBalance: number;
};

function getNumSignatures(signatures: string) {
  let bitfield = Number(signatures);
  let count = 0;
  while (bitfield > 0) {
    count += 1;
    bitfield = bitfield & (bitfield - 1);
  }
  return count;
}

function getSignatureBits(signatures: string) {
  return Number(signatures).toString(2).padStart(GUARDIAN_SET_3.length, '0');
}

function getGuardiansFromSignatures(signatures: string) {
  const guardians: string[] = [];
  const bitString = getSignatureBits(signatures);
  for (let idx = 0; idx < bitString.length; idx++) {
    if (bitString[idx] === '1') {
      guardians.push(GUARDIAN_SET_3[bitString.length - 1 - idx].name);
    }
  }
  return guardians.reverse().join(', ');
}

function getMissingGuardiansFromSignatures(signatures: string) {
  const guardians: string[] = [];
  const bitString = getSignatureBits(signatures);
  for (let idx = 0; idx < bitString.length; idx++) {
    if (bitString[idx] === '0') {
      guardians.push(GUARDIAN_SET_3[bitString.length - 1 - idx].name);
    }
  }
  return guardians.reverse().join(', ');
}

type GuardianSigningStat = {
  name: string;
  numSigned: number;
  outOf: number;
};

const calculatePercent = (stat: GuardianSigningStat): number => {
  try {
    return (stat.numSigned / stat.outOf) * 100;
  } catch (e) {
    return 0;
  }
};

const guardianSigningColumnHelper = createColumnHelper<GuardianSigningStat>();

const guardianSigningColumns = [
  guardianSigningColumnHelper.accessor('name', {
    header: () => 'Guardian',
    sortingFn: `text`,
  }),
  guardianSigningColumnHelper.accessor('numSigned', {
    header: () => <Box order="1">Signed</Box>,
    cell: (info) => (
      <Box textAlign="right">
        {info.getValue()} / {info.row.original.outOf}
      </Box>
    ),
  }),
  guardianSigningColumnHelper.accessor(calculatePercent, {
    id: 'progress',
    header: () => 'Progress',
    cell: (info) => (
      <Tooltip title={`${info.getValue().toFixed(2)}%`} arrow>
        <LinearProgress
          variant="determinate"
          value={info.getValue()}
          color={info.getValue() > 90 ? 'success' : info.getValue() > 50 ? 'warning' : 'error'}
        />
      </Tooltip>
    ),
  }),
];

const pendingTransferColumnHelper = createColumnHelper<PendingTransferForAcct>();

const pendingTransferColumns = [
  pendingTransferColumnHelper.accessor('key.emitter_chain', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  pendingTransferColumnHelper.accessor('key.emitter_address', {
    header: () => 'Emitter',
  }),
  pendingTransferColumnHelper.accessor('key.sequence', {
    header: () => 'Sequence',
  }),
  pendingTransferColumnHelper.accessor('data.0.tx_hash', {
    header: () => 'Tx',
    cell: (info) => {
      const tx = '0x' + Buffer.from(info.getValue(), 'base64').toString('hex');
      const chain = info.row.original.key.emitter_chain;
      const chainInfo = CHAIN_INFO_MAP[chain];
      if (!chainInfo) return tx;
      const txHash = getExplorerTxHash(chainInfo.chainId, tx);
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
  pendingTransferColumnHelper.accessor('data.0.signatures', {
    header: () => 'Signatures',
    cell: (info) => (
      <Tooltip
        title={
          <Box>
            <Typography gutterBottom sx={{ mb: 0.5 }}>
              Signed
            </Typography>
            <Typography variant="body2">{getGuardiansFromSignatures(info.getValue())}</Typography>
            <Typography gutterBottom sx={{ mt: 1.5, mb: 0.5 }}>
              Missing
            </Typography>
            <Typography variant="body2">
              {getMissingGuardiansFromSignatures(info.getValue())}
            </Typography>
            <Typography gutterBottom sx={{ mt: 1.5, mb: 0.5 }}>
              Bits
            </Typography>
            <Typography variant="body2">{getSignatureBits(info.getValue())}</Typography>
          </Box>
        }
      >
        <Box>{getNumSignatures(info.getValue())}</Box>
      </Tooltip>
    ),
  }),
  pendingTransferColumnHelper.accessor('isEnqueuedInGov', {
    header: () => 'Governed',
    cell: (info) => (info.getValue() ? <span role="img">✅</span> : null),
  }),
];

const accountsColumnHelper = createColumnHelper<AccountWithTokenData>();

const accountsColumns = [
  accountsColumnHelper.accessor('key.chain_id', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  accountsColumnHelper.accessor('key.token_chain', {
    header: () => 'Token Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  accountsColumnHelper.accessor('tokenData.native_address', {
    header: () => 'Native Address',
  }),
  accountsColumnHelper.accessor('tokenData.name', {
    header: () => 'Name',
  }),
  accountsColumnHelper.accessor('tokenData.symbol', {
    header: () => 'Symbol',
  }),
  accountsColumnHelper.accessor('tokenData.price_usd', {
    header: () => 'Price',
    cell: (info) => (info.getValue() ? numeral(info.getValue()).format('$0,0.0000') : ''),
  }),
  accountsColumnHelper.accessor('adjBalance', {
    header: () => 'Adjusted Balance',
    cell: (info) =>
      info.getValue() < 1
        ? info.getValue().toFixed(4)
        : numeral(info.getValue()).format('0,0.0000'),
  }),
  accountsColumnHelper.accessor('tvlTvm', {
    header: () => 'TVL/TVM',
    cell: (info) =>
      info.getValue() < 1
        ? `$${info.getValue().toFixed(4)}`
        : numeral(info.getValue()).format('$0,0.0000'),
  }),
  accountsColumnHelper.accessor('tokenData.decimals', {
    header: () => 'Decimals',
  }),
  accountsColumnHelper.accessor('key.token_address', {
    header: () => 'Token Address',
  }),
  accountsColumnHelper.accessor('balance', {
    header: () => 'Raw Balance',
  }),
];

type ChainTvlTvm = { chainId: number; tvl: number; tvm: number };

const overviewColumnHelper = createColumnHelper<ChainTvlTvm>();

const overviewColumns = [
  overviewColumnHelper.accessor('chainId', {
    header: () => 'Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  overviewColumnHelper.accessor('tvl', {
    header: () => 'Total Value Locked',
    cell: (info) =>
      info.getValue() < 1
        ? `$${info.getValue().toFixed(4)}`
        : numeral(info.getValue()).format('$0,0.0000'),
  }),
  overviewColumnHelper.accessor('tvm', {
    header: () => 'Total Value Minted',
    cell: (info) =>
      info.getValue() < 1
        ? `$${info.getValue().toFixed(4)}`
        : numeral(info.getValue()).format('$0,0.0000'),
  }),
];

function Accountant({ governorInfo }: { governorInfo: CloudGovernorInfo }) {
  const pendingTransferInfo = useGetAccountantPendingTransfers();

  const accountsInfo = useGetAccountantAccounts();

  const tokenData = useTokenData();

  const pendingTransfersForAcct: PendingTransferForAcct[] = useMemo(
    () =>
      pendingTransferInfo.map((transfer) => ({
        ...transfer,
        isEnqueuedInGov: !!governorInfo.enqueuedVAAs.find(
          (vaa) =>
            vaa.emitterChain === transfer.key.emitter_chain &&
            vaa.emitterAddress === transfer.key.emitter_address &&
            vaa.sequence === transfer.key.sequence.toString()
        ),
      })),
    [pendingTransferInfo, governorInfo.enqueuedVAAs]
  );

  const guardianSigningStats: GuardianSigningStat[] = useMemo(() => {
    const stats: GuardianSigningStat[] = GUARDIAN_SET_3.map((g) => ({
      name: g.name,
      numSigned: 0,
      outOf: pendingTransferInfo.length,
    }));
    for (const transfer of pendingTransferInfo) {
      const bitString = getSignatureBits(transfer.data[0].signatures);
      for (let idx = 0; idx < bitString.length; idx++) {
        if (bitString[idx] === '1') {
          stats[bitString.length - 1 - idx].numSigned += 1;
        }
      }
    }
    return stats;
  }, [pendingTransferInfo]);

  const accountsWithTokenData: AccountWithTokenData[] = useMemo(() => {
    return accountsInfo.map<AccountWithTokenData>((a) => {
      const thisTokenData = tokenData?.[`${a.key.token_chain}/${a.key.token_address}`];
      if (!thisTokenData)
        return {
          ...a,
          adjBalance: 0,
          tvlTvm: 0,
        };
      const adjBalance = Number(a.balance) / 10 ** thisTokenData.decimals;
      const tvlTvm = adjBalance * Number(thisTokenData.price_usd);
      return {
        ...a,
        tokenData: thisTokenData,
        adjBalance,
        tvlTvm,
      };
    });
  }, [accountsInfo, tokenData]);
  const tvlTvmPerChain: ChainTvlTvm[] = useMemo(
    () =>
      Object.values(
        accountsWithTokenData.reduce<{ [chainId: number]: ChainTvlTvm }>((prev, curr) => {
          if (!prev[curr.key.chain_id]) {
            prev[curr.key.chain_id] = { chainId: curr.key.chain_id, tvl: 0, tvm: 0 };
          }
          prev[curr.key.chain_id][curr.key.chain_id === curr.key.token_chain ? 'tvl' : 'tvm'] +=
            curr.tvlTvm;
          return prev;
        }, {})
      ),
    [accountsWithTokenData]
  );

  const [guardianSigningSorting, setGuardianSigningSorting] = useState<SortingState>([]);
  const guardianSigning = useReactTable({
    columns: guardianSigningColumns,
    data: guardianSigningStats,
    state: {
      sorting: guardianSigningSorting,
    },
    getRowId: (key) => JSON.stringify(key),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setGuardianSigningSorting,
  });
  const [pendingTransferSorting, setPendingTransferSorting] = useState<SortingState>([]);
  const pendingTransfer = useReactTable({
    columns: pendingTransferColumns,
    data: pendingTransfersForAcct,
    state: {
      sorting: pendingTransferSorting,
    },
    getRowId: (key) => JSON.stringify(key),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    onSortingChange: setPendingTransferSorting,
  });
  const [overviewSorting, setOverviewSorting] = useState<SortingState>([]);
  const overview = useReactTable({
    columns: overviewColumns,
    data: tvlTvmPerChain,
    state: {
      sorting: overviewSorting,
    },
    getRowId: (key) => JSON.stringify(key),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setOverviewSorting,
  });
  const [accountsSorting, setAccountsSorting] = useState<SortingState>([]);
  const accounts = useReactTable({
    columns: accountsColumns,
    data: accountsWithTokenData,
    state: {
      sorting: accountsSorting,
    },
    getRowId: (key) => JSON.stringify(key),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    onSortingChange: setAccountsSorting,
  });
  const pendingByChain = useMemo(
    () =>
      pendingTransferInfo.reduce((obj, cur) => {
        obj[cur.key.emitter_chain] = (obj[cur.key.emitter_chain] || 0) + 1;
        return obj;
      }, {} as { [chainId: number]: number }),
    [pendingTransferInfo]
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
          <Box>Accountant</Box>
          <Box flexGrow={1} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.keys(pendingByChain)
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
                    {pendingByChain[Number(chainId)]}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Box>
      }
    >
      {pendingTransferInfo.length ? (
        <Box mb={2}>
          <Card>
            <Table<GuardianSigningStat> table={guardianSigning} />
          </Card>
        </Box>
      ) : null}
      <Box mb={2}>
        <Card>
          <Table<PendingTransferForAcct>
            table={pendingTransfer}
            paginated={!!pendingTransferInfo.length}
            showRowCount={!!pendingTransferInfo.length}
          />
          {pendingTransferInfo.length === 0 ? (
            <Typography variant="body2" sx={{ py: 1, textAlign: 'center' }}>
              No pending transfers
            </Typography>
          ) : null}
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<ChainTvlTvm> table={overview} />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Accounts ({accountsInfo.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<AccountWithTokenData> table={accounts} paginated />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </CollapsibleSection>
  );
}
export default Accountant;
