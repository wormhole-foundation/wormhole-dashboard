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

function Guardians({
  heartbeats,
}: {
  heartbeats: GetLastHeartbeatsResponse_Entry[];
}) {
  return (
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
                        Number(heartbeat.rawHeartbeat.bootTimestamp) / 1000000
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
  );
}

export default Guardians;
