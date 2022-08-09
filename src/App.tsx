import { CHAINS } from "@certusone/wormhole-sdk";
import { Heartbeat_Network } from "@certusone/wormhole-sdk-proto-web/lib/cjs/gossip/v1/gossip";
import { GetLastHeartbeatsResponse_Entry } from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
import {
  Alert,
  Box,
  Card,
  createTheme,
  CssBaseline,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { getLastHeartbeats } from "./utils/getLastHeartbeats";

const chainIdToNameMap = Object.fromEntries(
  Object.entries(CHAINS).map(([key, value]) => [value, key])
);
const chainIdToName = (chainId: number) =>
  chainIdToNameMap[chainId] || "Unknown";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [heartbeats, setHeartbeats] = useState<
    GetLastHeartbeatsResponse_Entry[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const response = await getLastHeartbeats();
        if (!cancelled) {
          setHeartbeats(
            response.entries.sort(
              (a, b) =>
                a.rawHeartbeat?.nodeName.localeCompare(
                  b.rawHeartbeat?.nodeName || ""
                ) || -1
            )
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const chainIdsToHeartbeats: {
    [chainId: number]: {
      guardian: string;
      name: string;
      network: Heartbeat_Network;
    }[];
  } = {};
  heartbeats.forEach((heartbeat) => {
    heartbeat.rawHeartbeat?.networks.forEach((network) => {
      if (!chainIdsToHeartbeats[network.id]) {
        chainIdsToHeartbeats[network.id] = [];
      }
      chainIdsToHeartbeats[network.id].push({
        guardian: heartbeat.p2pNodeAddr,
        name: heartbeat.rawHeartbeat?.nodeName || "",
        network,
      });
    });
  });
  const alerts: string[] = [];
  Object.entries(chainIdsToHeartbeats).forEach(([chainId, heartbeats]) => {
    heartbeats.forEach((heartbeat) => {
      if (heartbeat.network.height === "0") {
        alerts.push(
          `${heartbeat.name} is down on ${chainIdToName(
            Number(chainId)
          )} (${chainId})!`
        );
      }
    });
  });
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {alerts.map((alert) => (
        <Alert key={alert} severity="error">
          {alert}
        </Alert>
      ))}
      <Box p={2}>
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Guardian</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Counter</TableCell>
                  <TableCell>Boot</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {heartbeats.map((heartbeat) => (
                  <TableRow key={heartbeat.p2pNodeAddr}>
                    <TableCell>{heartbeat.rawHeartbeat?.nodeName}</TableCell>
                    <TableCell>{heartbeat.rawHeartbeat?.version}</TableCell>
                    <TableCell>{heartbeat.rawHeartbeat?.counter}</TableCell>
                    <TableCell>
                      {heartbeat.rawHeartbeat?.bootTimestamp
                        ? new Date(
                            Number(heartbeat.rawHeartbeat.bootTimestamp) /
                              1000000
                          ).toLocaleString()
                        : null}
                    </TableCell>
                    <TableCell>
                      {heartbeat.rawHeartbeat?.timestamp
                        ? new Date(
                            Number(heartbeat.rawHeartbeat.timestamp) / 1000000
                          ).toLocaleString()
                        : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
      <Grid container>
        {Object.keys(chainIdsToHeartbeats).map((chainId) => (
          <Grid item xs={6}>
            <Box key={chainId} p={2}>
              <Card>
                <Box p={2}>
                  <Typography variant="h5" gutterBottom>
                    {chainIdToName(Number(chainId))} ({chainId})
                  </Typography>
                  <Typography>
                    Guardians Listed:{" "}
                    {chainIdsToHeartbeats[Number(chainId)].length}
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Guardian</TableCell>
                        <TableCell>Contract</TableCell>
                        <TableCell>Height</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {chainIdsToHeartbeats[Number(chainId)].map((info) => (
                        <TableRow
                          key={info.guardian}
                          style={
                            info.network.height === "0"
                              ? { backgroundColor: "rgba(100,0,0,.2)" }
                              : {}
                          }
                        >
                          <TableCell>
                            <Typography noWrap variant="body2">
                              {info.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{info.network.contractAddress}</TableCell>
                          <TableCell>{info.network.height}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Box>
          </Grid>
        ))}
      </Grid>
    </ThemeProvider>
  );
}

export default App;
