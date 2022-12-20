import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';

const root = ReactDOM.createRoot(document.getElementById('root') as Element);
root.render(
  <React.StrictMode>
    <ThemeProvider
      theme={createTheme({
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
      })}
    >
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
