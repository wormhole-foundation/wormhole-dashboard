import {
  AppBar,
  Box,
  createTheme,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import Alerts from "./components/Alerts";
import Chains from "./components/Chains";
import Guardians from "./components/Guardians";
import useChainHeartbeats from "./hooks/useChainHeartbeats";
import useHeartbeats from "./hooks/useHeartbeats";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  console.log(heartbeats);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar variant="dense">
          <Typography variant="h6">Wormhole Dashboard</Typography>
          <Box flexGrow={1} />
          {/* TODO: network selector */}
        </Toolbar>
      </AppBar>
      <Alerts chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Box p={2}>
        <Guardians heartbeats={heartbeats} />
      </Box>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
    </ThemeProvider>
  );
}

export default App;
