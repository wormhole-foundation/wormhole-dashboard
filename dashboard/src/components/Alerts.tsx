import {
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
} from '@certusone/wormhole-sdk';
import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  AlertColor,
  Box,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Environment, useCurrentEnvironment } from '../contexts/NetworkContext';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import useLatestRelease from '../hooks/useLatestRelease';
import chainIdToName from '../utils/chainIdToName';
import { GUARDIAN_SET_3 } from '../utils/consts';
import { Heartbeat } from '../utils/getLastHeartbeats';
import CollapsibleSection from './CollapsibleSection';

const BEHIND_DIFF = 1000;
const isLayer2 = (chainId: number) =>
  chainId === CHAIN_ID_POLYGON || chainId === CHAIN_ID_ARBITRUM || chainId === CHAIN_ID_OPTIMISM;
export const getBehindDiffForChain = (chainId: number) =>
  isLayer2(chainId) ? BEHIND_DIFF * 2 : BEHIND_DIFF;

export const getNumGuardians = (environment: Environment) =>
  environment === 'mainnet' ? GUARDIAN_SET_3.length : 1;

export function getQuorumCount(environment: Environment): number {
  return Math.floor((getNumGuardians(environment) * 2) / 3 + 1);
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
    .filter(([chainId]) => chainId !== CHAIN_ID_AURORA.toString())
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
}: {
  heartbeats: Heartbeat[];
  chainIdsToHeartbeats: ChainIdToHeartbeats;
}) {
  const latestRelease = useLatestRelease();
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
    <CollapsibleSection
      defaultExpanded={false}
      header={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 1,
          }}
        >
          <Tooltip
            title={
              <>
                <Typography variant="body1">
                  This section shows alerts for the following conditions:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <ErrorOutline color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Chains with a quorum of guardians down"
                      secondary={`A guardian is considered down if it is
                      reporting a height of 0, more than ${BEHIND_DIFF} behind the highest height, or missing from the list of
                      heartbeats`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <WarningAmberOutlined color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Chains with one or more guardians down"
                      secondary={`A guardian is considered down if it is
                      reporting a height of 0, more than ${BEHIND_DIFF} behind the highest height, or missing from the list of
                      heartbeats`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <InfoOutlined color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Guardians not running the latest release"
                      secondary={
                        <>
                          The guardian version is compared to the latest release from{' '}
                          <Link
                            href="https://github.com/wormhole-foundation/wormhole/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            https://github.com/wormhole-foundation/wormhole/releases
                          </Link>
                        </>
                      }
                    />
                  </ListItem>
                </List>
              </>
            }
            componentsProps={{ tooltip: { sx: { maxWidth: '100%' } } }}
          >
            <Box>
              Alerts
              <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
            </Box>
          </Tooltip>
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
              <CheckCircleOutline color="success" sx={{ ml: 2 }} />
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
      {alerts.map((alert) => (
        <Alert key={alert.text} severity={alert.severity}>
          {alert.text}
        </Alert>
      ))}
    </CollapsibleSection>
  );
}
export default Alerts;
