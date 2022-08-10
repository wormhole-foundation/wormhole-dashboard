import {
  AppBar,
  Box,
  createTheme,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import Main from "./components/Main";
import NetworkSelector from "./components/NetworkSelector";
import { NetworkContextProvider } from "./contexts/NetworkContext";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NetworkContextProvider>
        <AppBar position="static">
          <Toolbar variant="dense">
            <Typography variant="h6">Wormhole Dashboard</Typography>
            <Box flexGrow={1} />
            <NetworkSelector />
          </Toolbar>
        </AppBar>
        <Main />
      </NetworkContextProvider>
    </ThemeProvider>
  );
}

export default App;
