import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'settings';

export type Theme = 'light' | 'dark' | 'auto';

type Settings = {
  backgroundUrl?: string;
  backgroundOpacity?: number;
  theme: Theme;
  showChainName?: boolean;
  showUnknownChains?: boolean;
  showAllMisses?: boolean;
  showMonitorDetails?: boolean;
};

type SettingsContextValue = {
  settings: Settings;
  updateBackgroundOpacity(value: number): void;
  updateBackgroundUrl(value: string): void;
  updateTheme(value: Theme): void;
  updateShowChainName(value: boolean): void;
  updateShowUnknownChains(value: boolean): void;
  updateShowAllMisses(value: boolean): void;
  updateShowMonitorDetails(value: boolean): void;
};

const isTheme = (arg: any): arg is Theme => {
  return arg && (arg === 'light' || arg === 'dark' || arg === 'auto');
};

const isSettings = (arg: any): arg is Settings => {
  return arg && arg.theme && isTheme(arg.theme);
};

let localStorageSettings: Settings | null = null;
try {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value) {
    const parsedValue = JSON.parse(value);
    if (isSettings(parsedValue)) {
      localStorageSettings = parsedValue;
    }
  }
} catch (e) {}

const initialSettings: Settings = localStorageSettings || { theme: 'auto' };

const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
};

const SettingsContext = React.createContext<SettingsContextValue>({
  settings: initialSettings,
  updateBackgroundOpacity: (value: number) => {},
  updateBackgroundUrl: (value: string) => {},
  updateTheme: (value: Theme) => {},
  updateShowChainName: (value: boolean) => {},
  updateShowUnknownChains: (value: boolean) => {},
  updateShowAllMisses: (value: boolean) => {},
  updateShowMonitorDetails: (value: boolean) => {},
});

export const SettingsContextProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const updateBackgroundOpacity = useCallback((value: number) => {
    setSettings((settings) => ({ ...settings, backgroundOpacity: value }));
  }, []);
  const updateBackgroundUrl = useCallback((value: string) => {
    setSettings((settings) => ({ ...settings, backgroundUrl: value }));
  }, []);
  const updateTheme = useCallback((value: Theme) => {
    setSettings((settings) => ({ ...settings, theme: value }));
  }, []);
  const updateShowChainName = useCallback((value: boolean) => {
    setSettings((settings) => ({ ...settings, showChainName: value }));
  }, []);
  const updateShowUnknownChains = useCallback((value: boolean) => {
    setSettings((settings) => ({ ...settings, showUnknownChains: value }));
  }, []);
  const updateShowAllMisses = useCallback((value: boolean) => {
    setSettings((settings) => ({ ...settings, showAllMisses: value }));
  }, []);
  const updateShowMonitorDetails = useCallback((value: boolean) => {
    setSettings((settings) => ({ ...settings, showMonitorDetails: value }));
  }, []);
  // sync settings to state
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  const value = useMemo(
    () => ({
      settings,
      updateBackgroundOpacity,
      updateBackgroundUrl,
      updateTheme,
      updateShowChainName,
      updateShowUnknownChains,
      updateShowAllMisses,
      updateShowMonitorDetails,
    }),
    [
      settings,
      updateBackgroundOpacity,
      updateBackgroundUrl,
      updateTheme,
      updateShowChainName,
      updateShowUnknownChains,
      updateShowAllMisses,
      updateShowMonitorDetails,
    ]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettingsContext = () => {
  return useContext(SettingsContext);
};
