import React, {
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "auto";

type Settings = {
  theme: Theme;
};

type SettingsContextValue = {
  settings: Settings;
  updateTheme(value: Theme): void;
};

const SettingsContext = React.createContext<SettingsContextValue>({
  settings: { theme: "auto" },
  updateTheme: (value: Theme) => {},
});

export const SettingsContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [settings, setSettings] = useState<Settings>({ theme: "auto" });
  const updateTheme = useCallback((value: Theme) => {
    setSettings((settings) => ({ ...settings, theme: value }));
  }, []);
  const value = useMemo(
    () => ({ settings, updateTheme }),
    [settings, updateTheme]
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  return useContext(SettingsContext);
};
