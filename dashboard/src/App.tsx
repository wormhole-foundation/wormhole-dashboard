import { CssBaseline } from '@mui/material';
import { HashRouter as Router } from 'react-router-dom';
import CustomThemeProvider from './components/CustomThemeProvider';
import Main from './components/Main';
import { NetworkContextProvider } from './contexts/NetworkContext';
import { SettingsContextProvider } from './contexts/SettingsContext';

function App() {
  return (
    <SettingsContextProvider>
      <CustomThemeProvider>
        <CssBaseline />
        <Router>
          <NetworkContextProvider>
            <Main />
          </NetworkContextProvider>
        </Router>
      </CustomThemeProvider>
    </SettingsContextProvider>
  );
}

export default App;
