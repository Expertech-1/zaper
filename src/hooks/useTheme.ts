import { useEffect } from "react";
import { readCachedTheme } from "../lib/themeCache";
import { useSettingsStore } from "../stores/settings";
import type { Theme } from "../types/ipc";

/**
 * Applies the active theme by toggling the `.dark` class on `<html>`.
 *
 * The persisted setting is the source of truth. Until it loads, the cached value
 * from the previous session is used so the first paint does not flash the wrong
 * scheme.
 */
export function useTheme(): void {
  const theme = useSettingsStore((state) => state.settings?.theme);

  useEffect(() => {
    const resolvedPreference: Theme = theme ?? readCachedTheme() ?? "system";
    const root = document.documentElement;

    const apply = () => {
      const isDark =
        resolvedPreference === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : resolvedPreference === "dark";

      root.classList.toggle("dark", isDark);
    };

    apply();

    if (resolvedPreference !== "system") return;

    // Follow the desktop preference while "system" is selected.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
