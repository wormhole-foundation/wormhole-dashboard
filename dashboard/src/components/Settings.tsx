import {
  ContrastOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  SettingsOutlined,
} from '@mui/icons-material';
import {
  Box,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { Theme, useSettingsContext } from '../contexts/SettingsContext';

function SettingsContent() {
  const {
    settings,
    updateBackgroundOpacity,
    updateBackgroundUrl,
    updateTheme,
    updateShowChainName,
    updateShowUnknownChains,
    updateShowAllMisses,
    updateShowMonitorDetails,
  } = useSettingsContext();
  const handleThemeChange = useCallback(
    (event: any, newTheme: Theme) => {
      updateTheme(newTheme);
    },
    [updateTheme]
  );
  const handleBackgroundOpacityChange = useCallback(
    (event: any) => {
      updateBackgroundOpacity(event.target.value);
    },
    [updateBackgroundOpacity]
  );
  const handleBackgroundUrlChange = useCallback(
    (event: any) => {
      updateBackgroundUrl(event.target.value);
    },
    [updateBackgroundUrl]
  );
  const handleShowChainNameChange = useCallback(
    (event: any) => {
      updateShowChainName(event.target.checked);
    },
    [updateShowChainName]
  );
  const handleShowUnknownChainsChange = useCallback(
    (event: any) => {
      updateShowUnknownChains(event.target.checked);
    },
    [updateShowUnknownChains]
  );
  const handleShowAllMisses = useCallback(
    (event: any) => {
      updateShowAllMisses(event.target.checked);
    },
    [updateShowAllMisses]
  );
  const handleShowMonitorDetails = useCallback(
    (event: any) => {
      updateShowMonitorDetails(event.target.checked);
    },
    [updateShowMonitorDetails]
  );
  return (
    <>
      <Box mt={2} mx={2} textAlign="center">
        <ToggleButtonGroup value={settings.theme} exclusive onChange={handleThemeChange}>
          <ToggleButton value="light">
            <LightModeOutlined />
          </ToggleButton>
          <ToggleButton value="dark">
            <DarkModeOutlined />
          </ToggleButton>
          <ToggleButton value="auto">
            <ContrastOutlined />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box m={2}>
        <TextField
          value={settings.backgroundUrl || ''}
          onChange={handleBackgroundUrlChange}
          label="Background URL"
          margin="dense"
          fullWidth
        />
      </Box>
      <Box m={2}>
        <Typography variant="body2">Background Opacity</Typography>
        <Box pr={2} pt={2}>
          <Slider
            min={0.05}
            max={1}
            step={0.05}
            value={settings.backgroundOpacity || 0.1}
            onChange={handleBackgroundOpacityChange}
          />
        </Box>
      </Box>
      <Box m={2}>
        <FormControlLabel
          control={
            <Checkbox checked={!!settings.showChainName} onChange={handleShowChainNameChange} />
          }
          label="Show chain names"
        />
      </Box>
      <Box m={2}>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.showUnknownChains}
              onChange={handleShowUnknownChainsChange}
            />
          }
          label="Show unknown chains"
        />
      </Box>
      <Box m={2}>
        <FormControlLabel
          control={<Checkbox checked={!!settings.showAllMisses} onChange={handleShowAllMisses} />}
          label="Show all misses"
        />
      </Box>
      <Box m={2}>
        <FormControlLabel
          control={
            <Checkbox checked={!!settings.showMonitorDetails} onChange={handleShowMonitorDetails} />
          }
          label="Show monitor details"
        />
      </Box>
    </>
  );
}

function Settings() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <SettingsOutlined />
      </IconButton>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <SettingsContent />
      </Dialog>
    </>
  );
}

export default Settings;
