import { GitHub } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Divider,
  Hidden,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import { MonitorSettingsProvider } from '../contexts/MonitorSettingsContext';
import { useNetworkContext } from '../contexts/NetworkContext';
import useChainHeartbeats from '../hooks/useChainHeartbeats';
import useCloudGovernorInfo from '../hooks/useCloudGovernorInfo';
import useHeartbeats from '../hooks/useHeartbeats';
import WormholeStatsIcon from '../icons/WormholeStatsIcon';
import Accountant from './Accountant';
import Chains from './Chains';
import CollapsibleSection from './CollapsibleSection';
import Governor from './Governor';
import Guardians from './Guardians';
import MainnetGovernor from './MainnetGovernor';
import Monitor from './Monitor';
import NetworkSelector from './NetworkSelector';
import Settings from './Settings';
import Alerts from './Alerts';
import useLatestRelease from '../hooks/useLatestRelease';

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  const { currentNetwork } = useNetworkContext();
  const governorInfo = useCloudGovernorInfo();
  const latestRelease = useLatestRelease();
  return (
    <>
      <AppBar position="static">
        <Toolbar variant="dense">
          <Box pr={1} display="flex" alignItems="center">
            <WormholeStatsIcon />
          </Box>
          <Typography variant="h6">Dashboard</Typography>
          <Box flexGrow={1} />
          <Hidden smDown>
            <Alerts
              heartbeats={heartbeats}
              chainIdsToHeartbeats={chainIdsToHeartbeats}
              latestRelease={latestRelease}
            />
          </Hidden>
          <NetworkSelector />
          <IconButton
            sx={{ ml: 1 }}
            href="https://github.com/wormhole-foundation/wormhole-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
          >
            <GitHub />
          </IconButton>
          <Settings />
        </Toolbar>
      </AppBar>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Guardians
        heartbeats={heartbeats}
        chainIdsToHeartbeats={chainIdsToHeartbeats}
        latestRelease={latestRelease}
      />
      <Divider />
      {currentNetwork.name === 'Mainnet' ? (
        <>
          <MainnetGovernor governorInfo={governorInfo} />
          <Divider />
          <Accountant governorInfo={governorInfo} />
          <Divider />
          <MonitorSettingsProvider>
            <CollapsibleSection header="Monitor">
              <Monitor />
            </CollapsibleSection>
          </MonitorSettingsProvider>
        </>
      ) : (
        <Governor />
      )}
    </>
  );
}
export default Main;
