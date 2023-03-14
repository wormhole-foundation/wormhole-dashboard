import {
  ArrowDownward,
  ArrowUpward,
  FirstPage,
  LastPage,
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  SxProps,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Theme,
  useTheme,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { flexRender, Table as TanTable } from '@tanstack/react-table';

function Table<T>({
  table,
  paginated = false,
  showRowCount = false,
  conditionalRowStyle,
}: {
  table: TanTable<T>;
  paginated?: boolean;
  showRowCount?: boolean;
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
                          cursor: 'pointer',
                          userSelect: 'select-none',
                          ':hover': {
                            background: theme.palette.mode === 'dark' ? grey[800] : grey[100],
                          },
                        }
                      : {}
                  }
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <Box display="flex" alignContent="center">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    <Box flexGrow={1} />
                    <Box display="flex" alignItems="center">
                      {{
                        asc: <ArrowUpward fontSize="small" sx={{ ml: 0.5 }} />,
                        desc: <ArrowDownward fontSize="small" sx={{ ml: 0.5 }} />,
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
        {paginated || showRowCount ? (
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={table
                  .getHeaderGroups()
                  .reduce((total, headerGroup) => total + headerGroup.headers.length, 0)}
              >
                <Box display="flex" alignItems="center">
                  <Box>{table.getCoreRowModel().rows.length} Rows</Box>
                  <Box flexGrow={1} />
                  {paginated ? (
                    <>
                      <Select
                        margin="dense"
                        size="small"
                        value={table.getState().pagination.pageSize}
                        onChange={(e) => {
                          table.setPageSize(Number(e.target.value));
                        }}
                        sx={{
                          fontSize: '10px',
                          mr: 0.5,
                          '& > div': { py: '6px' },
                        }}
                      >
                        {[10, 25, 50, 100].map((pageSize) => (
                          <MenuItem key={pageSize} value={pageSize}>
                            Show {pageSize}
                          </MenuItem>
                        ))}
                      </Select>
                      <IconButton
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                        size="small"
                      >
                        <FirstPage fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        size="small"
                      >
                        <NavigateBefore fontSize="small" />
                      </IconButton>
                      <Box>
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                      </Box>
                      <IconButton
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        size="small"
                      >
                        <NavigateNext fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                        size="small"
                      >
                        <LastPage fontSize="small" />
                      </IconButton>
                    </>
                  ) : null}
                </Box>
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </MuiTable>
    </TableContainer>
  );
}
export default Table;
