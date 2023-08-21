import { GitHub } from '@mui/icons-material';
import { AppBar, Box, Button, Hidden, IconButton, Toolbar, Typography } from '@mui/material';
import { Route, HashRouter as Router, Switch, NavLink } from 'react-router-dom';
import useChainHeartbeats from '../hooks/useChainHeartbeats';
import useHeartbeats from '../hooks/useHeartbeats';
import useLatestRelease from '../hooks/useLatestRelease';
import WormholeStatsIcon from '../icons/WormholeStatsIcon';
import Alerts from './Alerts';
import Home from './Home';
import NetworkSelector from './NetworkSelector';
import Settings from './Settings';
import Metrics from './Metrics';

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  const latestRelease = useLatestRelease();
  return (
    <Router>
      <AppBar position="static">
        <Toolbar variant="dense">
          <NavLink
            to="/"
            exact
            component={Button}
            color="inherit"
            activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
            style={{ marginLeft: -8, textTransform: 'none', borderRadius: 0 }}
          >
            <Box display="flex" alignItems="center">
              <WormholeStatsIcon />
            </Box>
            <Typography variant="h6" sx={{ pl: 0.75 }}>
              Dashboard
            </Typography>
          </NavLink>
          <NavLink
            to="/metrics"
            exact
            component={Button}
            color="inherit"
            activeStyle={{ borderBottom: '2px solid', paddingBottom: 4 }}
            style={{ paddingRight: 8, marginLeft: 8, textTransform: 'none', borderRadius: 0 }}
          >
            <Typography variant="h6">Metrics</Typography>
          </NavLink>
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
        <Route path="/metrics">
          <Metrics />
        </Route>
        <Route path="/">
          <Home
            heartbeats={heartbeats}
            chainIdsToHeartbeats={chainIdsToHeartbeats}
            latestRelease={latestRelease}
          />
        </Route>
      </Switch>
    </Router>
  );
}
export default Main;
