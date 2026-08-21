import type { AppInfo, Theme } from "../../types/ipc";
import { readCachedTheme } from "../../lib/themeCache";
import { useSettingsStore } from "../../stores/settings";
import { Button } from "../ui/Button";

interface TopbarProps {
  appInfo: AppInfo | null;
  bridgeError: string | null;
}

const THEME_CYCLE: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_GLYPH: Record<Theme, string> = { system: "🌓", light: "☀️", dark: "🌙" };
const THEME_LABEL: Record<Theme, string> = {
  system: "Theme: follow desktop",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function Topbar({ appInfo, bridgeError }: TopbarProps) {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  // Fall back to the cached value so the control shows the right glyph during
  // the initial load instead of flickering through "system".
  const theme: Theme = settings?.theme ?? readCachedTheme() ?? "system";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Workspace</span>
        <BridgePill appInfo={appInfo} bridgeError={bridgeError} />
        <ActiveProfilePill />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={saving || !settings}
          onClick={() => void patch({ theme: THEME_CYCLE[theme] })}
          aria-label={THEME_LABEL[theme]}
          title={THEME_LABEL[theme]}
        >
          {THEME_GLYPH[theme]}
        </Button>
      </div>
    </header>
  );
}

/** Shows which profile answers are grounded in — visible from every screen. */
function ActiveProfilePill() {
  const activeProfileId = useSettingsStore((state) => state.settings?.activeProfileId ?? null);

  if (!activeProfileId) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
      <span className="size-1.5 rounded-full bg-brand-500" />
      profile active
    </span>
  );
}

function BridgePill({ appInfo, bridgeError }: TopbarProps) {
  if (bridgeError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        <span className="size-1.5 rounded-full bg-red-500" />
        bridge error
      </span>
    );
  }

  if (!appInfo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" />
        connecting…
      </span>
    );
  }

  const isTauriRuntime = appInfo.environment !== "browser";

  return (
    <span
      title={`v${appInfo.version} · ${appInfo.environment} · ${appInfo.platform}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isTauriRuntime
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${isTauriRuntime ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {isTauriRuntime ? `Rust core · v${appInfo.version}` : "browser preview"}
    </span>
  );
}
