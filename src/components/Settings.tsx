import {
  ContrastOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  Dialog,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useCallback, useState } from "react";
import { Theme, useSettingsContext } from "../contexts/SettingsContext";

function SettingsContent() {
  const { settings, updateTheme } = useSettingsContext();
  const handleThemeChange = useCallback(
    (event: any, newTheme: Theme) => {
      updateTheme(newTheme);
    },
    [updateTheme]
  );
  return (
    <>
      <ToggleButtonGroup
        value={settings.theme}
        exclusive
        onChange={handleThemeChange}
      >
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
      <Dialog open={open} onClose={handleClose}>
        <SettingsContent />
      </Dialog>
    </>
  );
}

export default Settings;
