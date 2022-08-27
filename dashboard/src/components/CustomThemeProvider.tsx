import { createTheme, responsiveFontSizes, ThemeProvider } from "@mui/material";
import { grey } from "@mui/material/colors";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsContext } from "../contexts/SettingsContext";

const mediaQueryList =
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

function CustomThemeProvider({ children }: { children: ReactNode }) {
  const {
    settings: { theme: themePreference },
  } = useSettingsContext();
  const [userPrefersDark, setUserPrefersDark] = useState<boolean>(
    mediaQueryList && mediaQueryList.matches ? true : false
  );
  const handleUserPreferenceChange = useCallback(
    (event: MediaQueryListEvent) => {
      setUserPrefersDark(event.matches ? true : false);
    },
    []
  );
  useEffect(() => {
    if (themePreference === "auto") {
      mediaQueryList.addEventListener("change", handleUserPreferenceChange);
      return () => {
        mediaQueryList.removeEventListener(
          "change",
          handleUserPreferenceChange
        );
      };
    }
  }, [themePreference, handleUserPreferenceChange]);
  const mode =
    themePreference === "dark" ||
    (themePreference === "auto" && userPrefersDark)
      ? "dark"
      : "light";
  const theme = useMemo(
    () =>
      responsiveFontSizes(
        createTheme({
          palette: {
            mode,
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
        })
      ),
    [mode]
  );
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export default CustomThemeProvider;
