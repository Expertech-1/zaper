/**
 * Settings store — the frontend's view of the persisted settings document.
 *
 * The database is the source of truth: every mutation goes to Rust and the
 * store adopts whatever comes back, so the UI can never drift from what was
 * actually saved (including normalization the backend applied).
 */

import { create } from "zustand";
import { IpcError, toIpcError } from "../lib/errors";
import { cacheTheme } from "../lib/themeCache";
import { getSettings, resetSettings, updateSettings } from "../services/settings";
import type { Settings, SettingsPatch } from "../types/ipc";
import type { LoadStatus } from "./status";

interface SettingsState {
  settings: Settings | null;
  status: LoadStatus;
  error: IpcError | null;
  /** True while a write is in flight, so forms can disable their controls. */
  saving: boolean;

  load: () => Promise<void>;
  patch: (patch: SettingsPatch) => Promise<void>;
  reset: () => Promise<void>;
  clearError: () => void;
}

/** Guards against duplicate concurrent loads (e.g. two mounts in one tick). */
let inFlightLoad: Promise<void> | null = null;

export const useSettingsStore = create<SettingsState>()((set) => {
  const adopt = (settings: Settings) => {
    // Cache the theme so the next launch paints correctly before IPC resolves.
    cacheTheme(settings.theme);
    set({ settings, status: "ready", error: null });
  };

  return {
    settings: null,
    status: "idle",
    error: null,
    saving: false,

    load: async () => {
      if (inFlightLoad) return inFlightLoad;

      set({ status: "loading", error: null });

      inFlightLoad = (async () => {
        try {
          adopt(await getSettings());
        } catch (cause) {
          set({ status: "error", error: toIpcError(cause) });
        } finally {
          inFlightLoad = null;
        }
      })();

      return inFlightLoad;
    },

    patch: async (patch) => {
      set({ saving: true, error: null });
      try {
        adopt(await updateSettings(patch));
      } catch (cause) {
        // Keep the previously loaded settings visible; surface the error beside
        // the form rather than blanking the screen.
        set({ error: toIpcError(cause) });
        throw cause;
      } finally {
        set({ saving: false });
      }
    },

    reset: async () => {
      set({ saving: true, error: null });
      try {
        adopt(await resetSettings());
      } catch (cause) {
        set({ error: toIpcError(cause) });
        throw cause;
      } finally {
        set({ saving: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});
