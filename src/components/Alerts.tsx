import { Alert } from "@mui/material";
import { ChainIdToHeartbeats } from "../hooks/useChainHeartbeats";
import chainIdToName from "../utils/chainIdToName";

function Alerts({
  chainIdsToHeartbeats,
}: {
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
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
    <>
      {alerts.map((alert) => (
        <Alert key={alert} severity="error">
          {alert}
        </Alert>
      ))}
    </>
  );
}
export default Alerts;
