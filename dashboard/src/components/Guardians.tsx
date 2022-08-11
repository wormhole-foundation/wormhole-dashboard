import { GetLastHeartbeatsResponse_Entry } from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

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
      <TableContainer>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    sx={
                      header.column.getCanSort()
                        ? {
                            cursor: "pointer",
                            userSelect: "select-none",
                            ":hover": { background: grey[800] },
                          }
                        : {}
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{
                      asc: " 🔼",
                      desc: " 🔽",
                    }[header.column.getIsSorted() as string] ?? null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

export default Guardians;
