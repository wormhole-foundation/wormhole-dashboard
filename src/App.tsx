import {
  AppBar,
  Box,
  createTheme,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import Main from "./components/Main";
import NetworkSelector from "./components/NetworkSelector";
import { NetworkContextProvider } from "./contexts/NetworkContext";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflowY: "scroll",
        },
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: `${grey[700]} ${grey[900]}`,
        },
        "*::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
          backgroundColor: grey[900],
        },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: grey[700],
          borderRadius: "4px",
        },
        "*::-webkit-scrollbar-corner": {
          // this hides an annoying white box which appears when both scrollbars are present
          backgroundColor: "transparent",
        },
      },
    },
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
