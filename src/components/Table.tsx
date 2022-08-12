import {
  SxProps,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Theme,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import { flexRender, Table as TanTable } from "@tanstack/react-table";

function Table<T>({
  table,
  conditionalRowStyle,
}: {
  table: TanTable<T>;
  conditionalRowStyle?: (a: T) => SxProps<Theme> | undefined;
}) {
  return (
    <TableContainer>
      <MuiTable size="small">
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
            <TableRow
              key={row.id}
              sx={conditionalRowStyle ? conditionalRowStyle(row.original) : {}}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
}
export default Table;
