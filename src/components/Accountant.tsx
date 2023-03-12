import { Box, Card, LinearProgress, Tooltip, Typography } from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useSettingsContext } from "../contexts/SettingsContext";
import useGetAccountantPendingTransfers, {
  PendingTransfer,
} from "../hooks/useGetAccountantPendingTransfers";
import chainIdToName from "../utils/chainIdToName";
import { GUARDIAN_SET_3 } from "../utils/consts";
import Table from "./Table";

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
  return Number(signatures).toString(2).padStart(GUARDIAN_SET_3.length, "0");
}

function getGuardiansFromSignatures(signatures: string) {
  const guardians: string[] = [];
  const bitString = getSignatureBits(signatures);
  for (let idx = 0; idx < bitString.length; idx++) {
    if (bitString[idx] === "1") {
      guardians.push(GUARDIAN_SET_3[bitString.length - 1 - idx].name);
    }
  }
  return guardians.reverse().join(", ");
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
  guardianSigningColumnHelper.accessor("name", {
    header: () => "Guardian",
    sortingFn: `text`,
  }),
  guardianSigningColumnHelper.accessor("numSigned", {
    header: () => <Box order="1">Signed</Box>,
    cell: (info) => (
      <Box textAlign="right">
        {info.getValue()} / {info.row.original.outOf}
      </Box>
    ),
  }),
  guardianSigningColumnHelper.accessor(calculatePercent, {
    id: "progress",
    header: () => "Progress",
    cell: (info) => (
      <Tooltip title={`${info.getValue().toFixed(2)}%`} arrow>
        <LinearProgress
          variant="determinate"
          value={info.getValue()}
          color={
            info.getValue() > 90
              ? "success"
              : info.getValue() > 50
              ? "warning"
              : "error"
          }
        />
      </Tooltip>
    ),
  }),
];

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
    cell: (info) => (
      <Tooltip
        title={
          <Box>
            <Typography gutterBottom>
              {getGuardiansFromSignatures(info.getValue())}
            </Typography>
            <Typography gutterBottom>
              {getSignatureBits(info.getValue())}
            </Typography>
          </Box>
        }
      >
        <Box>{getNumSignatures(info.getValue())}</Box>
      </Tooltip>
    ),
  }),
];

function Accountant() {
  const {
    settings: { wormchainUrl },
  } = useSettingsContext();
  const pendingTransferInfo = useGetAccountantPendingTransfers();
  const guardianSigningStats: GuardianSigningStat[] = useMemo(() => {
    const stats: GuardianSigningStat[] = GUARDIAN_SET_3.map((g) => ({
      name: g.name,
      numSigned: 0,
      outOf: pendingTransferInfo.length,
    }));
    for (const transfer of pendingTransferInfo) {
      const bitString = getSignatureBits(transfer.data[0].signatures);
      for (let idx = 0; idx < bitString.length; idx++) {
        if (bitString[idx] === "1") {
          stats[bitString.length - 1 - idx].numSigned += 1;
        }
      }
    }
    return stats;
  }, [pendingTransferInfo]);
  const [guardianSigningSorting, setGuardianSigningSorting] =
    useState<SortingState>([]);
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
  return !wormchainUrl ? (
    <Typography sx={{ p: 2 }}>
      Wormchain URL unset. Please configure in the settings to enable accountant
      info.
    </Typography>
  ) : (
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
          <Table<PendingTransfer> table={pendingTransfer} paginated />
        </Card>
      </Box>
    </>
  );
}
export default Accountant;
