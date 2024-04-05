import { chainToChainId } from '@wormhole-foundation/sdk-base';
import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  AlertColor,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import { Environment, useCurrentEnvironment } from '../contexts/NetworkContext';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import { GUARDIAN_SET_3 } from '../utils/consts';
import { Heartbeat } from '../utils/getLastHeartbeats';
import { chainIdToName } from '@wormhole-foundation/wormhole-monitor-common';

export const BEHIND_DIFF = 1000;
export const CHAIN_LESS_THAN_MAX_WARNING_THRESHOLD = 2;
const isLayer2 = (chainId: number) =>
  chainId === chainToChainId('Polygon') ||
  chainId === chainToChainId('Arbitrum') ||
  chainId === chainToChainId('Optimism');
export const getBehindDiffForChain = (chainId: number) =>
  isLayer2(chainId) ? BEHIND_DIFF * 2 : BEHIND_DIFF;

export const getNumGuardians = (environment: Environment) =>
  environment === 'mainnet' ? GUARDIAN_SET_3.length : 1;

export function getQuorumCount(environment: Environment): number {
  return Math.floor((getNumGuardians(environment) * 2) / 3 + 1);
}

export function getWarningCount(environment: Environment): number {
  return Math.max(getNumGuardians(environment) - CHAIN_LESS_THAN_MAX_WARNING_THRESHOLD + 1, 1);
}

function getQuorumLossCount(environment: Environment): number {
  return getNumGuardians(environment) - getQuorumCount(environment) + 1;
}

type AlertEntry = {
  severity: AlertColor;
  text: string;
};

const alertSeverityOrder: AlertColor[] = ['error', 'warning', 'success', 'info'];

function chainDownAlerts(
  heartbeats: Heartbeat[],
  chainIdsToHeartbeats: ChainIdToHeartbeats,
  environment: Environment
): AlertEntry[] {
  const downChains: { [chainId: string]: string[] } = {};
  Object.entries(chainIdsToHeartbeats)
    // Aurora is known to be disabled, no need to alert on it
    .filter(([chainId]) => chainId !== chainToChainId('Aurora').toString())
    .forEach(([chainId, chainHeartbeats]) => {
      // Search for known guardians without heartbeats
      const missingGuardians = heartbeats.filter(
        (guardianHeartbeat) =>
          chainHeartbeats.findIndex(
            (chainHeartbeat) => chainHeartbeat.guardian === guardianHeartbeat.guardianAddr
          ) === -1
      );
      missingGuardians.forEach((guardianHeartbeat) => {
        if (!downChains[chainId]) {
          downChains[chainId] = [];
        }
        downChains[chainId].push(guardianHeartbeat.nodeName);
      });
      // Search for guardians with heartbeats but who are not picking up a height
      // Could be disconnected or erroring post initial checks
      // Track highest height to check for lagging guardians
      let highest = BigInt(0);
      chainHeartbeats.forEach((chainHeartbeat) => {
        const height = BigInt(chainHeartbeat.network.height);
        if (height > highest) {
          highest = height;
        }
        if (chainHeartbeat.network.height === '0') {
          if (!downChains[chainId]) {
            downChains[chainId] = [];
          }
          downChains[chainId].push(chainHeartbeat.name);
        }
      });
      // Search for guardians which are lagging significantly behind
      chainHeartbeats.forEach((chainHeartbeat) => {
        if (chainHeartbeat.network.height !== '0') {
          const height = BigInt(chainHeartbeat.network.height);
          const diff = highest - height;
          if (diff > getBehindDiffForChain(chainHeartbeat.network.id)) {
            if (!downChains[chainId]) {
              downChains[chainId] = [];
            }
            downChains[chainId].push(chainHeartbeat.name);
          }
        }
      });
    });
  return Object.entries(downChains).map(([chainId, names]) => ({
    severity: names.length >= getQuorumLossCount(environment) ? 'error' : 'warning',
    text: `${names.length} guardian${names.length > 1 ? 's' : ''} [${names.join(', ')}] ${
      names.length > 1 ? 'are' : 'is'
    } down on ${chainIdToName(Number(chainId))} (${chainId})!`,
  }));
}

const releaseChecker = (release: string | null, heartbeats: Heartbeat[]): AlertEntry[] =>
  release === null
    ? []
    : heartbeats
        .filter((heartbeat) => heartbeat.version !== release)
        .map((heartbeat) => ({
          severity: 'info',
          text: `${heartbeat.nodeName} is not running the latest release (${heartbeat.version} !== ${release})`,
        }));

function Alerts({
  heartbeats,
  chainIdsToHeartbeats,
  latestRelease,
}: {
  heartbeats: Heartbeat[];
  chainIdsToHeartbeats: ChainIdToHeartbeats;
  latestRelease: string | null;
}) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  const environment = useCurrentEnvironment();
  const alerts = useMemo(() => {
    const alerts: AlertEntry[] = [
      ...chainDownAlerts(heartbeats, chainIdsToHeartbeats, environment),
      ...releaseChecker(latestRelease, heartbeats),
    ];
    return alerts.sort((a, b) =>
      alertSeverityOrder.indexOf(a.severity) < alertSeverityOrder.indexOf(b.severity)
        ? -1
        : alertSeverityOrder.indexOf(a.severity) > alertSeverityOrder.indexOf(b.severity)
        ? 1
        : 0
    );
  }, [latestRelease, heartbeats, chainIdsToHeartbeats, environment]);
  const numErrors = useMemo(
    () => alerts.filter((alert) => alert.severity === 'error').length,
    [alerts]
  );
  const numInfos = useMemo(
    () => alerts.filter((alert) => alert.severity === 'info').length,
    [alerts]
  );
  const numSuccess = useMemo(
    () => alerts.filter((alert) => alert.severity === 'success').length,
    [alerts]
  );
  const numWarnings = useMemo(
    () => alerts.filter((alert) => alert.severity === 'warning').length,
    [alerts]
  );
  return (
    <>
      <Button
        sx={{
          display: 'flex',
          alignItems: 'center',
          mx: 2,
          '& svg:not(:first-of-type)': { ml: 1 },
        }}
        color="inherit"
        onClick={handleOpen}
      >
        {numInfos > 0 ? (
          <>
            <InfoOutlined color="info" />
            <Typography component="strong" sx={{ ml: 0.5 }}>
              {numInfos}
            </Typography>
          </>
        ) : null}
        {numSuccess > 0 ? (
          <>
            <CheckCircleOutline color="success" />
            <Typography component="strong" sx={{ ml: 0.5 }}>
              {numSuccess}
            </Typography>
          </>
        ) : null}
        {numWarnings > 0 ? (
          <>
            <WarningAmberOutlined color="warning" />
            <Typography component="strong" sx={{ ml: 0.5 }}>
              {numWarnings}
            </Typography>
          </>
        ) : null}
        {numErrors > 0 ? (
          <>
            <ErrorOutline color="error" />
            <Typography component="strong" sx={{ ml: 0.5 }}>
              {numErrors}
            </Typography>
          </>
        ) : null}
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Alerts</DialogTitle>
        <DialogContent>
          {alerts.map((alert) => (
            <Alert key={alert.text} severity={alert.severity}>
              {alert.text}
            </Alert>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
export default Alerts;
