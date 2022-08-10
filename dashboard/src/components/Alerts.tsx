import { Alert, AlertColor } from "@mui/material";
import { ChainIdToHeartbeats } from "../hooks/useChainHeartbeats";
import chainIdToName from "../utils/chainIdToName";

type AlertEntry = {
  severity: AlertColor;
  text: string;
};

function Alerts({
  chainIdsToHeartbeats,
}: {
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
  const alerts: AlertEntry[] = [];
  const downChains: { [chainId: string]: string[] } = {};
  Object.entries(chainIdsToHeartbeats).forEach(([chainId, heartbeats]) => {
    heartbeats.forEach((heartbeat) => {
      if (heartbeat.network.height === "0") {
        if (!downChains[chainId]) {
          downChains[chainId] = [];
        }
        downChains[chainId].push(heartbeat.name);
      }
    });
  });
  Object.entries(downChains).forEach(([chainId, names]) => {
    alerts.push({
      severity: names.length >= 7 ? "error" : "warning",
      text: `${names.join(", ")} ${
        names.length > 1 ? "are" : "is"
      } down on ${chainIdToName(Number(chainId))} (${chainId})!`,
    });
  });
  return (
    <>
      {alerts.map((alert) => (
        <Alert key={alert.text} severity={alert.severity}>
          {alert.text}
        </Alert>
      ))}
    </>
  );
}
export default Alerts;
