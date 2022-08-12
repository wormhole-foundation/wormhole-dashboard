import {
  ErrorOutline,
  ExpandMore,
  InfoOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertColor,
  Box,
  Card,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
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
  const alerts = useMemo(() => {
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
    return alerts;
  }, [chainIdsToHeartbeats]);
  const numErrors = useMemo(
    () => alerts.filter((alert) => alert.severity === "error").length,
    [alerts]
  );
  const numInfos = useMemo(
    () => alerts.filter((alert) => alert.severity === "info").length,
    [alerts]
  );
  const numSuccess = useMemo(
    () => alerts.filter((alert) => alert.severity === "success").length,
    [alerts]
  );
  const numWarnings = useMemo(
    () => alerts.filter((alert) => alert.severity === "warning").length,
    [alerts]
  );
  return (
    <Card>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography
            variant="h6"
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              paddingRight: 1,
            }}
          >
            Alerts
            <Box flexGrow={1} />
            {numInfos > 0 ? (
              <>
                <InfoOutlined color="info" sx={{ ml: 2 }} />
                <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                  {numInfos}
                </Typography>
              </>
            ) : null}
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
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {alerts.map((alert) => (
            <Alert key={alert.text} severity={alert.severity}>
              {alert.text}
            </Alert>
          ))}
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}
export default Alerts;
