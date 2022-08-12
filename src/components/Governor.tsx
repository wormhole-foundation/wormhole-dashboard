import {
  GovernorGetAvailableNotionalByChainResponse_Entry,
  GovernorGetEnqueuedVAAsResponse_Entry,
  GovernorGetTokenListResponse_Entry,
} from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import useGovernorInfo from "../hooks/useGovernorInfo";
import chainIdToName from "../utils/chainIdToName";
import Table from "./Table";

const calculatePercent = (
  notional: GovernorGetAvailableNotionalByChainResponse_Entry
): number => {
  try {
    return (
      ((Number(notional.notionalLimit) -
        Number(notional.remainingAvailableNotional)) /
        Number(notional.notionalLimit)) *
      100
    );
  } catch (e) {
    return 0;
  }
};

const notionalColumnHelper =
  createColumnHelper<GovernorGetAvailableNotionalByChainResponse_Entry>();

const notionalColumns = [
  notionalColumnHelper.accessor("chainId", {
    header: () => "Chain",
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  notionalColumnHelper.accessor("notionalLimit", {
    header: () => "Limit",
  }),
  notionalColumnHelper.accessor("remainingAvailableNotional", {
    header: () => "Remaining",
  }),
  notionalColumnHelper.accessor(calculatePercent, {
    id: "progress",
    header: () => "Progress",
    cell: (info) => (
      <Tooltip title={info.getValue()} arrow>
        <LinearProgress
          variant="determinate"
          value={info.getValue()}
          color={
            info.getValue() > 80
              ? "error"
              : info.getValue() > 50
              ? "warning"
              : "success"
          }
        />
      </Tooltip>
    ),
  }),
];

const enqueuedColumnHelper =
  createColumnHelper<GovernorGetEnqueuedVAAsResponse_Entry>();

const enqueuedColumns = [
  enqueuedColumnHelper.accessor("emitterChain", {
    header: () => "Chain",
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  enqueuedColumnHelper.accessor("emitterAddress", {
    header: () => "Emitter",
  }),
  enqueuedColumnHelper.accessor("sequence", {
    header: () => "Sequence",
  }),
];

const tokenColumnHelper =
  createColumnHelper<GovernorGetTokenListResponse_Entry>();

const tokenColumns = [
  tokenColumnHelper.accessor("originChainId", {
    header: () => "Chain",
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  tokenColumnHelper.accessor("originAddress", {
    header: () => "Token",
  }),
  tokenColumnHelper.accessor("price", {
    header: () => "Price",
  }),
];

function Governor() {
  const governorInfo = useGovernorInfo();
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
    data: governorInfo.enqueued,
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
    data: governorInfo.tokens,
    state: {
      sorting: tokenSorting,
    },
    getRowId: (token) => `${token.originChainId}_${token.originAddress}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setTokenSorting,
  });
  return (
    <>
      <Box mb={2}>
        <Card>
          <Table<GovernorGetAvailableNotionalByChainResponse_Entry>
            table={notionalTable}
          />
        </Card>
      </Box>
      <Box my={2}>
        <Card>
          <Table<GovernorGetEnqueuedVAAsResponse_Entry> table={enqueuedTable} />
          {governorInfo.enqueued.length === 0 ? (
            <Typography variant="body2" sx={{ py: 1, textAlign: "center" }}>
              No enqueued VAAs
            </Typography>
          ) : null}
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Tokens ({governorInfo.tokens.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table<GovernorGetTokenListResponse_Entry> table={tokenTable} />
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </>
  );
}
export default Governor;
