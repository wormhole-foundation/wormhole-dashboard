import { CHAIN_ID_AURORA } from "@certusone/wormhole-sdk";
import {
  ErrorOutline,
  InfoOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  SxProps,
  Theme,
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
import { useCallback, useMemo, useState } from "react";
import {
  ChainIdToHeartbeats,
  HeartbeatInfo,
} from "../hooks/useChainHeartbeats";
import chainIdToName from "../utils/chainIdToName";
import { CHAIN_INFO_MAP } from "../utils/consts";
import { getBehindDiffForChain, QUORUM_COUNT } from "./Alerts";
import CollapsibleSection from "./CollapsibleSection";
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

function ChainDetails({
  heartbeats,
  conditionalRowStyle,
}: {
  heartbeats: HeartbeatInfo[];
  conditionalRowStyle?:
    | ((a: HeartbeatInfo) => SxProps<Theme> | undefined)
    | undefined;
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
    <Table<HeartbeatInfo>
      table={table}
      conditionalRowStyle={conditionalRowStyle}
    />
  );
}

const isHeartbeatUnhealthy = (heartbeat: HeartbeatInfo, highest: bigint) =>
  heartbeat.network.height === "0" ||
  highest - BigInt(heartbeat.network.height) >
    getBehindDiffForChain(heartbeat.network.id);

function Chain({
  chainId,
  heartbeats,
  healthyCount,
  conditionalRowStyle,
}: {
  chainId: string;
  heartbeats: HeartbeatInfo[];
  healthyCount: number;
  conditionalRowStyle?:
    | ((a: HeartbeatInfo) => SxProps<Theme> | undefined)
    | undefined;
}) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <Box width="80px" m={2} textAlign={"center"}>
        <Tooltip
          title={
            <Box textAlign="center">
              <Typography>
                {chainIdToName(Number(chainId))} ({chainId})
              </Typography>
              <Typography>
                {healthyCount} / {heartbeats.length}
              </Typography>
            </Box>
          }
        >
          <Button onClick={handleOpen} sx={{ borderRadius: "50%" }}>
            <Box sx={{ position: "relative", display: "inline-flex" }}>
              <CircularProgress
                variant="determinate"
                value={
                  healthyCount === 0
                    ? 100
                    : (healthyCount / heartbeats.length) * 100
                }
                color={
                  healthyCount < QUORUM_COUNT
                    ? "error"
                    : healthyCount < heartbeats.length
                    ? "warning"
                    : "success"
                }
                thickness={6}
                size={74}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography component="div" color="text.secondary">
                  {CHAIN_INFO_MAP[chainId]?.icon ? (
                    <Box
                      sx={{
                        borderRadius: "50%",
                        display: "flex",
                        p: 1.25,
                        backgroundColor: "rgba(0,0,0,0.5)",
                      }}
                    >
                      <img
                        src={CHAIN_INFO_MAP[chainId]?.icon}
                        alt={chainId}
                        width={34}
                        height={34}
                      />
                    </Box>
                  ) : (
                    chainId
                  )}
                </Typography>
              </Box>
            </Box>
          </Button>
        </Tooltip>
      </Box>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {chainIdToName(Number(chainId))} ({chainId})
        </DialogTitle>
        <DialogContent>
          <ChainDetails
            heartbeats={heartbeats}
            conditionalRowStyle={conditionalRowStyle}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type ChainHelpers = {
  [chainId: string]: {
    healthyCount: number;
    conditionalRowStyle?:
      | ((a: HeartbeatInfo) => SxProps<Theme> | undefined)
      | undefined;
  };
};

function Chains({
  chainIdsToHeartbeats,
}: {
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
  const {
    helpers,
    numSuccess,
    numWarnings,
    numErrors,
  }: {
    helpers: ChainHelpers;
    numSuccess: number;
    numWarnings: number;
    numErrors: number;
  } = useMemo(() => {
    let numSuccess = 0;
    let numWarnings = 0;
    let numErrors = 0;
    const helpers = Object.entries(chainIdsToHeartbeats).reduce(
      (obj, [chainId, heartbeats]) => {
        let highest = BigInt(0);
        heartbeats.forEach((heartbeat) => {
          const height = BigInt(heartbeat.network.height);
          if (height > highest) {
            highest = height;
          }
        });
        const conditionalRowStyle = (heartbeat: HeartbeatInfo) =>
          isHeartbeatUnhealthy(heartbeat, highest)
            ? { backgroundColor: "rgba(100,0,0,.2)" }
            : {};
        const healthyCount = heartbeats.reduce(
          (count, heartbeat) =>
            count + (isHeartbeatUnhealthy(heartbeat, highest) ? 0 : 1),
          0
        );
        if (Number(chainId) !== CHAIN_ID_AURORA)
          if (healthyCount < QUORUM_COUNT) {
            numErrors++;
          } else if (healthyCount < heartbeats.length) {
            numWarnings++;
          } else {
            numSuccess++;
          }
        obj[chainId] = { healthyCount, conditionalRowStyle };
        return obj;
      },
      {} as ChainHelpers
    );
    return {
      helpers,
      numSuccess,
      numWarnings,
      numErrors,
    };
  }, [chainIdsToHeartbeats]);
  return (
    <CollapsibleSection
      header={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            paddingRight: 1,
          }}
        >
          <Box>Chains</Box>
          <Box flexGrow={1} />
          {numSuccess > 0 ? (
            <>
              <InfoOutlined color="success" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numSuccess}
              </Typography>
            </>
          ) : null}
          {numWarnings > 0 ? (
            <>
              <WarningAmberOutlined color="warning" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numWarnings}
              </Typography>
            </>
          ) : null}
          {numErrors > 0 ? (
            <>
              <ErrorOutline color="error" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {numErrors}
              </Typography>
            </>
          ) : null}
        </Box>
      }
    >
      <Box
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent={"center"}
      >
        {Object.keys(chainIdsToHeartbeats).map((chainId) => (
          <Chain
            key={chainId}
            chainId={chainId}
            heartbeats={chainIdsToHeartbeats[Number(chainId)]}
            healthyCount={helpers[Number(chainId)].healthyCount}
            conditionalRowStyle={helpers[Number(chainId)].conditionalRowStyle}
          />
        ))}
      </Box>
    </CollapsibleSection>
  );
}

export default Chains;
