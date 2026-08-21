/**
 * Last-known theme, cached in `localStorage` purely so the first paint matches
 * the user's choice before the settings IPC call resolves.
 *
 * This is a cache, not a source of truth: the persisted setting in SQLite wins,
 * and this value is overwritten whenever settings load or change.
 */

import { themeSchema, type Theme } from "../types/ipc";

const STORAGE_KEY = "zaper.theme";

/** Reads the cached theme, or `null` when nothing usable is stored. */
export function readCachedTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = themeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    // Private mode or a disabled storage API: the cache is optional, so a
    // failure here must never break startup.
    return null;
  }
}

/** Updates the cache. Failures are ignored for the same reason. */
export function cacheTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignored — see above */
  }
}
