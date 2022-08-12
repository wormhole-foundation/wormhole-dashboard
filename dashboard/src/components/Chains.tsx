import { Box, Card, Grid, Typography } from "@mui/material";
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  ChainIdToHeartbeats,
  HeartbeatInfo,
} from "../hooks/useChainHeartbeats";
import chainIdToName from "../utils/chainIdToName";
import Table from "./Table";

const columnHelper = createColumnHelper<HeartbeatInfo>();

const columns = [
  columnHelper.accessor("name", {
    header: () => "Guardian",
    cell: (info) => (
      <Typography variant="body2" noWrap>
        {info.getValue()}
      </Typography>
    ),
    sortingFn: `text`,
  }),
  columnHelper.accessor("network.height", {
    header: () => "Height",
  }),
  columnHelper.accessor("network.contractAddress", {
    header: () => "Contract",
  }),
];

const conditionalRowStyle = (heartbeat: HeartbeatInfo) =>
  heartbeat.network.height === "0"
    ? { backgroundColor: "rgba(100,0,0,.2)" }
    : {};

function Chain({
  chainId,
  heartbeats,
}: {
  chainId: string;
  heartbeats: HeartbeatInfo[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: heartbeats,
    state: {
      sorting,
    },
    getRowId: (heartbeat) => heartbeat.guardian,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });
  return (
    <Grid key={chainId} item xs={12} lg={6}>
      <Card>
        <Box p={2}>
          <Typography variant="h5" gutterBottom>
            {chainIdToName(Number(chainId))} ({chainId})
          </Typography>
          <Typography>Guardians Listed: {heartbeats.length}</Typography>
        </Box>
        <Table<HeartbeatInfo>
          table={table}
          conditionalRowStyle={conditionalRowStyle}
        />
      </Card>
    </Grid>
  );
}

function Chains({
  chainIdsToHeartbeats,
}: {
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
  return (
    <Grid container spacing={2}>
      {Object.keys(chainIdsToHeartbeats).map((chainId) => (
        <Chain
          key={chainId}
          chainId={chainId}
          heartbeats={chainIdsToHeartbeats[Number(chainId)]}
        />
      ))}
    </Grid>
  );
}

export default Chains;
