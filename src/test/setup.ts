import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { resetDevBackend } from "../services/devBackend";
import { useProfilesStore } from "../stores/profiles";
import { useSettingsStore } from "../stores/settings";

// jsdom does not implement `window.matchMedia`, which the theme hook relies on.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
});

// jsdom lacks `crypto.randomUUID` in some versions; the preview backend uses it
// to mint ids.
if (typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    writable: true,
    value: () =>
      `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}` as ReturnType<
        Crypto["randomUUID"]
      >,
  });
}

/**
 * Stores and the preview backend are module singletons, so state would otherwise
 * leak between tests and make them order-dependent.
 */
beforeEach(() => {
  resetDevBackend();
  window.localStorage.clear();

  useSettingsStore.setState({ settings: null, status: "idle", error: null, saving: false });
  useProfilesStore.setState({ summaries: [], status: "idle", error: null, mutating: false });
});
