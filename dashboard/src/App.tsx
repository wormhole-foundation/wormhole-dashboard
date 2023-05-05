import { CssBaseline } from '@mui/material';
import CustomThemeProvider from './components/CustomThemeProvider';
import Main from './components/Main';
import { NetworkContextProvider } from './contexts/NetworkContext';
import { SettingsContextProvider } from './contexts/SettingsContext';

function App() {
  return (
    <SettingsContextProvider>
      <CustomThemeProvider>
        <CssBaseline />
        <NetworkContextProvider>
          <Main />
        </NetworkContextProvider>
      </CustomThemeProvider>
    </SettingsContextProvider>
  );
}

export default App;
