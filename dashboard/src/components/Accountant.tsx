import { ExpandMore, Search } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  GUARDIAN_SET_4,
  chainIdToName,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Buffer } from 'buffer';
import numeral from 'numeral';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { CloudGovernorInfo } from '../hooks/useCloudGovernorInfo';
import useGetAccountantAccounts, { Account } from '../hooks/useGetAccountantAccounts';
import useGetAccountantPendingTransfers, {
  PendingTransfer,
} from '../hooks/useGetAccountantPendingTransfers';
import { TokenDataByChainAddress, TokenDataEntry } from '../hooks/useTokenData';
import { CHAIN_ICON_MAP, WORMCHAIN_URL } from '../utils/consts';
import { queryContractSmart } from '@wormhole-foundation/wormhole-monitor-common/src/queryContractSmart';
import CollapsibleSection from './CollapsibleSection';
import { ExplorerTxHash } from './ExplorerTxHash';
import Table from './Table';

const NTT_ACCOUNTANT_TOKEN_ADDRESS_OVERRIDE: {
  [chain: number]: { [tokenAddress: string]: string };
} = {
  1: {
    cf5f3614e2cd9b374558f35c7618b25f0d306d5e749b7d29cc030a1a15686238:
      '6927fdc01ea906f96d7137874cdd7adad00ca35764619310e54196c781d84d5b',
  },
};

type PendingTransferForAcct = PendingTransfer & { isEnqueuedInGov: boolean };
type AccountWithTokenData = Account & {
  tokenData: TokenDataEntry;
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
  return Number(signatures).toString(2).padStart(GUARDIAN_SET_4.length, '0');
}

function getGuardiansFromSignatures(signatures: string) {
  const guardians: string[] = [];
  const bitString = getSignatureBits(signatures);
  for (let idx = 0; idx < bitString.length; idx++) {
    if (bitString[idx] === '1') {
      guardians.push(GUARDIAN_SET_4[bitString.length - 1 - idx].name);
    }
  }
  return guardians.reverse().join(', ');
}

function getMissingGuardiansFromSignatures(signatures: string) {
  const guardians: string[] = [];
  const bitString = getSignatureBits(signatures);
  for (let idx = 0; idx < bitString.length; idx++) {
    if (bitString[idx] === '0') {
      guardians.push(GUARDIAN_SET_4[bitString.length - 1 - idx].name);
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
    cell: (info) => (
      <ExplorerTxHash
        chainId={info.row.original.key.emitter_chain}
        rawTxHash={'0x' + Buffer.from(info.getValue(), 'base64').toString('hex')}
      />
    ),
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
    enableGlobalFilter: false,
  }),
  accountsColumnHelper.accessor('key.token_chain', {
    header: () => 'Token Chain',
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
    enableGlobalFilter: false,
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
  accountsColumnHelper.accessor('tokenData.coin_gecko_coin_id', {
    header: () => 'Coin Gecko ID',
  }),
  accountsColumnHelper.accessor('tokenData.price_usd', {
    header: () => 'Price',
    cell: (info) => (info.getValue() ? numeral(info.getValue()).format('$0,0.0000') : ''),
    enableGlobalFilter: false,
  }),
  accountsColumnHelper.accessor('adjBalance', {
    header: () => 'Adjusted Balance',
    cell: (info) =>
      info.getValue() < 1
        ? info.getValue().toFixed(4)
        : numeral(info.getValue()).format('0,0.0000'),
    enableGlobalFilter: false,
  }),
  accountsColumnHelper.accessor('tvlTvm', {
    header: () => 'TVL/TVM',
    cell: (info) =>
      info.getValue() < 1
        ? `$${info.getValue().toFixed(4)}`
        : numeral(info.getValue()).format('$0,0.0000'),
    enableGlobalFilter: false,
  }),
  accountsColumnHelper.accessor('tokenData.decimals', {
    header: () => 'Decimals',
    enableGlobalFilter: false,
  }),
  accountsColumnHelper.accessor('key.token_address', {
    header: () => 'Token Address',
  }),
  accountsColumnHelper.accessor('balance', {
    header: () => 'Raw Balance',
    enableGlobalFilter: false,
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

function AccountantSearch() {
  const [raw_emitter_chain, setChain] = useState<number | undefined>();
  const [raw_emitter_address, setAddress] = useState<string>('');
  const [raw_sequence, setSequence] = useState<number | undefined>();
  const [response, setResponse] = useState<any>(null);
  const handleChain = useCallback((event: any) => {
    if (!event.target.value) {
      setChain(undefined);
    }
    try {
      const n = parseInt(event.target.value);
      if (!isNaN(n)) {
        setChain(n);
      }
    } catch (e) {}
  }, []);
  const handleAddress = useCallback((event: any) => {
    setAddress(event.target.value);
  }, []);
  const handleSequence = useCallback((event: any) => {
    if (!event.target.value) {
      setSequence(undefined);
    }
    try {
      const n = parseInt(event.target.value);
      if (!isNaN(n)) {
        setSequence(n);
      }
    } catch (e) {}
  }, []);
  const [emitter_chain] = useDebounce(raw_emitter_chain, 500);
  const [emitter_address] = useDebounce(raw_emitter_address, 500);
  const [sequence] = useDebounce(raw_sequence, 500);
  useEffect(() => {
    if (emitter_chain && emitter_address && sequence) {
      setResponse(null);
      let cancelled = false;
      (async () => {
        try {
          const response = await queryContractSmart(WORMCHAIN_URL, ACCOUNTANT_CONTRACT_ADDRESS, {
            transfer_status: {
              emitter_chain,
              emitter_address,
              sequence,
            },
          });
          if (!cancelled) {
            setResponse(response);
          }
        } catch (error) {
          if (!cancelled) {
            setResponse({});
          }
          console.error(error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [emitter_chain, emitter_address, sequence]);
  return (
    <>
      <Typography variant="subtitle1">Transfer Key</Typography>
      <TextField
        sx={{ mt: 1 }}
        label="Chain"
        fullWidth
        onChange={handleChain}
        value={raw_emitter_chain}
        size="small"
      />
      <TextField
        sx={{ mt: 1 }}
        label="Address"
        fullWidth
        onChange={handleAddress}
        value={raw_emitter_address}
        size="small"
      />
      <TextField
        sx={{ mt: 1 }}
        label="Sequence"
        fullWidth
        onChange={handleSequence}
        value={raw_sequence}
        size="small"
      />
      {emitter_chain && emitter_address && sequence ? (
        response ? (
          <pre>{JSON.stringify(response, undefined, 2)}</pre>
        ) : (
          <CircularProgress sx={{ mt: 2 }} />
        )
      ) : (
        <Typography sx={{ mt: 2 }}>Enter a transfer key above</Typography>
      )}
    </>
  );
}

const MemoizedAccountantSearch = memo(AccountantSearch);

function Accountant({
  governorInfo,
  tokenData,
  accountantAddress,
  isNTT,
}: {
  governorInfo?: CloudGovernorInfo;
  tokenData: TokenDataByChainAddress | null;
  accountantAddress: string;
  isNTT?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback((event: any) => {
    event.stopPropagation();
    setOpen(true);
  }, []);
  const handleClose = useCallback((event: any) => {
    setOpen(false);
  }, []);

  const pendingTransferInfo = useGetAccountantPendingTransfers(accountantAddress);

  const accountsInfo = useGetAccountantAccounts(accountantAddress);

  const governorInfoIsDefined = !!governorInfo;

  const pendingTransfersForAcct: PendingTransferForAcct[] = useMemo(
    () =>
      pendingTransferInfo.map((transfer) => ({
        ...transfer,
        isEnqueuedInGov:
          governorInfoIsDefined &&
          !!governorInfo.enqueuedVAAs.find(
            (vaa) =>
              vaa.emitterChain === transfer.key.emitter_chain &&
              vaa.emitterAddress === transfer.key.emitter_address &&
              vaa.sequence === transfer.key.sequence.toString()
          ),
      })),
    [pendingTransferInfo, governorInfoIsDefined, governorInfo?.enqueuedVAAs]
  );

  const guardianSigningStats: GuardianSigningStat[] = useMemo(() => {
    const stats: GuardianSigningStat[] = GUARDIAN_SET_4.map((g) => ({
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
      let token_chain = a.key.token_chain;
      let token_address = a.key.token_address;
      if (isNTT) {
        token_address =
          NTT_ACCOUNTANT_TOKEN_ADDRESS_OVERRIDE[token_chain]?.[token_address] || token_address;
      }
      const thisTokenData = tokenData?.[`${token_chain}/${token_address}`];
      if (!thisTokenData)
        return {
          ...a,
          adjBalance: 0,
          tvlTvm: 0,
          tokenData: {
            coin_gecko_coin_id: '',
            decimals: 0,
            name: '',
            native_address: '',
            price_usd: '',
            symbol: '',
            token_address: '',
            token_chain: 0,
          },
        };
      const adjBalance = Number(a.balance) / 10 ** Math.min(thisTokenData.decimals, 8);
      const tvlTvm = adjBalance * Number(thisTokenData.price_usd);
      return {
        ...a,
        tokenData: thisTokenData,
        adjBalance,
        tvlTvm,
      };
    });
  }, [accountsInfo, tokenData, isNTT]);
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
  const [accountsGlobalFilter, setAccountsGlobalFilter] = useState('');
  const handleAccountsGlobalFilterChange = useCallback((e: any) => {
    setAccountsGlobalFilter(e.target.value);
  }, []);
  const [accountsSorting, setAccountsSorting] = useState<SortingState>([]);
  const accounts = useReactTable({
    columns: accountsColumns,
    data: accountsWithTokenData,
    state: {
      globalFilter: accountsGlobalFilter,
      sorting: accountsSorting,
    },
    getRowId: (token) => JSON.stringify(token.key),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
    onGlobalFilterChange: setAccountsGlobalFilter,
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
    <>
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
            <Box>{isNTT ? 'NTT ' : ''}Accountant</Box>
            {isNTT ? null : (
              <Box ml={1}>
                <IconButton onClick={handleOpen} size="small">
                  <Search fontSize="inherit" />
                </IconButton>
              </Box>
            )}
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
                          alt={chainIdToName(Number(chainId))}
                          width={24}
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
                <TextField
                  type="search"
                  value={accountsGlobalFilter}
                  onChange={handleAccountsGlobalFilterChange}
                  margin="dense"
                  size="small"
                  sx={{ mb: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="Search Token"
                />
                <Table<AccountWithTokenData> table={accounts} paginated noWrap />
              </AccordionDetails>
            </Accordion>
          </Card>
        </Box>
      </CollapsibleSection>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Accountant Transfer Search</DialogTitle>
        <DialogContent>
          <MemoizedAccountantSearch />
        </DialogContent>
      </Dialog>
    </>
  );
}
export default Accountant;
