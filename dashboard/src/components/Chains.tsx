import {
  Box,
  Card,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ChainIdToHeartbeats } from "../hooks/useChainHeartbeats";
import chainIdToName from "../utils/chainIdToName";

function Chains({
  chainIdsToHeartbeats,
}: {
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
  return (
    <Grid container>
      {Object.keys(chainIdsToHeartbeats).map((chainId) => (
        <Grid key={chainId} item xs={12} lg={6}>
          <Box p={2}>
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
  );
}

export default Chains;
