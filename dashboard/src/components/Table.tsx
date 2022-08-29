import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import {
  Box,
  SxProps,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Theme,
  useTheme,
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
  const theme = useTheme();
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
                          ":hover": {
                            background:
                              theme.palette.mode === "dark"
                                ? grey[800]
                                : grey[100],
                          },
                        }
                      : {}
                  }
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <Box display="flex" alignContent="center">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    <Box flexGrow={1} />
                    <Box display="flex" alignItems="center">
                      {{
                        asc: <ArrowUpward fontSize="small" sx={{ ml: 0.5 }} />,
                        desc: (
                          <ArrowDownward fontSize="small" sx={{ ml: 0.5 }} />
                        ),
                      }[header.column.getIsSorted() as string] ?? null}
                    </Box>
                  </Box>
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
