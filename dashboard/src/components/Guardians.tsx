import { GetLastHeartbeatsResponse_Entry } from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
import { Card } from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import Table from "./Table";

const columnHelper = createColumnHelper<GetLastHeartbeatsResponse_Entry>();

const columns = [
  columnHelper.accessor("rawHeartbeat.nodeName", {
    header: () => "Guardian",
    sortingFn: `text`,
  }),
  columnHelper.accessor("rawHeartbeat.version", {
    header: () => "Version",
  }),
  columnHelper.accessor("rawHeartbeat.features", {
    header: () => "Features",
    cell: (info) =>
      info.getValue().length > 0 ? info.getValue().join(", ") : "none",
  }),
  columnHelper.accessor("rawHeartbeat.counter", {
    header: () => "Counter",
  }),
  columnHelper.accessor("rawHeartbeat.bootTimestamp", {
    header: () => "Boot",
    cell: (info) =>
      info.getValue()
        ? new Date(Number(info.getValue()) / 1000000).toLocaleString()
        : null,
  }),
  columnHelper.accessor("rawHeartbeat.timestamp", {
    header: () => "Timestamp",
    cell: (info) =>
      info.getValue()
        ? new Date(Number(info.getValue()) / 1000000).toLocaleString()
        : null,
  }),
];

function Guardians({
  heartbeats,
}: {
  heartbeats: GetLastHeartbeatsResponse_Entry[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: heartbeats,
    state: {
      sorting,
    },
    getRowId: (heartbeat) => heartbeat.p2pNodeAddr,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  return (
    <Card>
      <Table<GetLastHeartbeatsResponse_Entry> table={table} />
    </Card>
  );
}

export default Guardians;
