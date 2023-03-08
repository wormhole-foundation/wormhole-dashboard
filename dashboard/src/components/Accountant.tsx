import { Box, Card, Typography } from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useSettingsContext } from "../contexts/SettingsContext";
import useGetAccountantPendingTransfers, {
  PendingTransfer,
} from "../hooks/useGetAccountantPendingTransfers";
import chainIdToName from "../utils/chainIdToName";
import Table from "./Table";

const pendingTransferColumnHelper = createColumnHelper<PendingTransfer>();

const pendingTransferColumns = [
  pendingTransferColumnHelper.accessor("key.emitter_chain", {
    header: () => "Chain",
    cell: (info) => `${chainIdToName(info.getValue())} (${info.getValue()})`,
    sortingFn: `text`,
  }),
  pendingTransferColumnHelper.accessor("key.emitter_address", {
    header: () => "Emitter",
  }),
  pendingTransferColumnHelper.accessor("key.sequence", {
    header: () => "Sequence",
  }),
  pendingTransferColumnHelper.accessor("data.0.tx_hash", {
    header: () => "Tx",
    cell: (info) => Buffer.from(info.getValue(), "base64").toString("hex"),
  }),
  pendingTransferColumnHelper.accessor("data.0.signatures", {
    header: () => "Signatures",
  }),
];

function Accountant() {
  const {
    settings: { wormchainUrl },
  } = useSettingsContext();
  const pendingTransferInfo = useGetAccountantPendingTransfers();
  const [pendingTransferSorting, setPendingTransferSorting] =
    useState<SortingState>([]);
  const pendingTransfer = useReactTable({
    columns: pendingTransferColumns,
    data: pendingTransferInfo,
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
  return (
    <>
      <Box mb={2}>
        <Card>
          {!wormchainUrl ? (
            <Typography sx={{ p: 2 }}>
              Wormchain URL unset. Please configure in the settings to enable
              accountant info.
            </Typography>
          ) : (
            <Table<PendingTransfer> table={pendingTransfer} paginated />
          )}
        </Card>
      </Box>
    </>
  );
}
export default Accountant;
