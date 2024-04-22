import {
  AnalyticsOutlined,
  GitHub,
  ReceiptLongOutlined,
  SyncAltOutlined,
} from '@mui/icons-material';
import { AppBar, Box, Button, Hidden, IconButton, Toolbar, Typography } from '@mui/material';
import { NavLink, Route, Switch, useLocation } from 'react-router-dom';
import useChainHeartbeats from '../hooks/useChainHeartbeats';
import useHeartbeats from '../hooks/useHeartbeats';
import useLatestRelease from '../hooks/useLatestRelease';
import WormholeStatsIcon from '../icons/WormholeStatsIcon';
import Alerts from './Alerts';
import Contracts from './Contracts';
import Home from './Home';
import Metrics from './Metrics';
import NTTMetrics from './NTTMetrics';
import NetworkSelector from './NetworkSelector';
import Settings from './Settings';

function NavButton(props: any) {
  // fix for Invalid value for prop `navigate` on <a> tag
  const { navigate, ...rest } = props;
  return <Button {...rest} />;
}

function NavLinks() {
  const { search } = useLocation();
  return (
    <>
      <NavLink
        to={`/${search}`}
        exact
        component={NavButton}
        color="inherit"
        activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
        style={{ marginLeft: -8, textTransform: 'none', borderRadius: 0, minWidth: 0 }}
      >
        <Box display="flex" alignItems="center">
          <WormholeStatsIcon />
        </Box>
        <Hidden mdDown>
          <Typography variant="h6" sx={{ pl: 0.75 }}>
            Dashboard
          </Typography>
        </Hidden>
      </NavLink>
      <NavLink
        to={`/contracts${search}`}
        exact
        component={NavButton}
        color="inherit"
        activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
        style={{
          paddingRight: 8,
          marginLeft: 8,
          textTransform: 'none',
          borderRadius: 0,
          minWidth: 0,
        }}
      >
        <Hidden mdUp>
          <ReceiptLongOutlined />
        </Hidden>
        <Hidden mdDown>
          <Typography variant="h6">Contracts</Typography>
        </Hidden>
      </NavLink>
      <NavLink
        to={`/metrics${search}`}
        exact
        component={NavButton}
        color="inherit"
        activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
        style={{
          paddingRight: 8,
          marginLeft: 8,
          textTransform: 'none',
          borderRadius: 0,
          minWidth: 0,
        }}
      >
        <Hidden mdUp>
          <AnalyticsOutlined />
        </Hidden>
        <Hidden mdDown>
          <Typography variant="h6">Metrics</Typography>
        </Hidden>
      </NavLink>
      <NavLink
        to={`/ntt-metrics${search}`}
        exact
        component={NavButton}
        color="inherit"
        activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
        style={{
          paddingRight: 8,
          marginLeft: 8,
          textTransform: 'none',
          borderRadius: 0,
          minWidth: 0,
        }}
      >
        <Hidden mdUp>
          <SyncAltOutlined />
        </Hidden>
        <Hidden mdDown>
          <Typography variant="h6">NTT</Typography>
        </Hidden>
      </NavLink>
    </>
  );
}

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  const latestRelease = useLatestRelease();
  return (
    <>
      <AppBar position="static">
        <Toolbar variant="dense" sx={{ minHeight: 40 }}>
          <NavLinks />
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
      <Switch>
        <Route path="/ntt-metrics">
          <NTTMetrics />
        </Route>
        <Route path="/metrics">
          <Metrics />
        </Route>
        <Route path="/contracts">
          <Contracts />
        </Route>
        <Route path="/">
          <Home
            heartbeats={heartbeats}
            chainIdsToHeartbeats={chainIdsToHeartbeats}
            latestRelease={latestRelease}
          />
        </Route>
      </Switch>
    </>
  );
}
export default Main;
