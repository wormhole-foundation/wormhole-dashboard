import { Card } from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Heartbeat } from "../utils/getLastHeartbeats";
import Table from "./Table";

const columnHelper = createColumnHelper<Heartbeat>();

const columns = [
  columnHelper.accessor("nodeName", {
    header: () => "Guardian",
    sortingFn: `text`,
  }),
  columnHelper.accessor("version", {
    header: () => "Version",
  }),
  columnHelper.accessor("features", {
    header: () => "Features",
    cell: (info) =>
      info.getValue().length > 0 ? info.getValue().join(", ") : "none",
  }),
  columnHelper.accessor("counter", {
    header: () => "Counter",
  }),
  columnHelper.accessor("bootTimestamp", {
    header: () => "Boot",
    cell: (info) =>
      info.getValue()
        ? new Date(Number(info.getValue()) / 1000000).toLocaleString()
        : null,
  }),
  columnHelper.accessor("timestamp", {
    header: () => "Timestamp",
    cell: (info) =>
      info.getValue()
        ? new Date(Number(info.getValue()) / 1000000).toLocaleString()
        : null,
  }),
  columnHelper.accessor("guardianAddr", {
    header: () => "Address",
  }),
  //columnHelper.accessor("p2pNodeAddr", {
  //  header: () => "P2P Address",
  //}),
];

function Guardians({ heartbeats }: { heartbeats: Heartbeat[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: heartbeats,
    state: {
      sorting,
    },
    getRowId: (heartbeat) => heartbeat.guardianAddr,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  return (
    <Card>
      <Table<Heartbeat> table={table} />
    </Card>
  );
}

export default Guardians;
