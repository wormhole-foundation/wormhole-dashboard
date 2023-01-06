import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';

const root = ReactDOM.createRoot(document.getElementById('root') as Element);
const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          maxWidth: 'none',
        },
      },
    },
  },
});
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
