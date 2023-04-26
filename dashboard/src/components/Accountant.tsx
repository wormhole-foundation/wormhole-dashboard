import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  LinearProgress,
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
import { GUARDIAN_SET_3 } from '../utils/consts';
import Table from './Table';

type PendingTransferForAcct = PendingTransfer & { isEnqueuedInGov: boolean };

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
    cell: (info) => Buffer.from(info.getValue(), 'base64').toString('hex'),
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

const accountsColumnHelper = createColumnHelper<Account>();

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
  accountsColumnHelper.accessor('key.token_address', {
    header: () => 'Token Address',
  }),
  accountsColumnHelper.accessor('balance', {
    header: () => 'Balance',
  }),
];

function Accountant({ governorInfo }: { governorInfo: CloudGovernorInfo }) {
  const pendingTransferInfo = useGetAccountantPendingTransfers();

  const accountsInfo = useGetAccountantAccounts();

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
  const [accountsSorting, setAccountsSorting] = useState<SortingState>([]);
  const accounts = useReactTable({
    columns: accountsColumns,
    data: accountsInfo,
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
  return (
    <>
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
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Accounts ({accountsInfo.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<Account> table={accounts} paginated />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </>
  );
}
export default Accountant;
