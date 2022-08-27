import { GitHub } from "@mui/icons-material";
import {
  AppBar,
  Box,
  CssBaseline,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import CustomThemeProvider from "./components/CustomThemeProvider";
import Main from "./components/Main";
import NetworkSelector from "./components/NetworkSelector";
import Settings from "./components/Settings";
import { NetworkContextProvider } from "./contexts/NetworkContext";
import { SettingsContextProvider } from "./contexts/SettingsContext";
import WormholeStatsIcon from "./icons/WormholeStatsIcon";

function App() {
  return (
    <SettingsContextProvider>
      <CustomThemeProvider>
        <CssBaseline />
        <NetworkContextProvider>
          <AppBar position="static">
            <Toolbar variant="dense">
              <Box pr={1} display="flex" alignItems="center">
                <WormholeStatsIcon />
              </Box>
              <Typography variant="h6">Dashboard</Typography>
              <Box flexGrow={1} />
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
          <Main />
        </NetworkContextProvider>
      </CustomThemeProvider>
    </SettingsContextProvider>
  );
}

export default App;
