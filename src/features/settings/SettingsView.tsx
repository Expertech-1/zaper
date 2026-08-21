import { useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, LoadingRow } from "../../components/ui/Feedback";
import { useSettingsStore } from "../../stores/settings";
import { AssistantSection } from "./AssistantSection";
import { AudioSection } from "./AudioSection";
import { PrivacySection } from "./PrivacySection";
import { ProvidersSection } from "./ProvidersSection";
import { ShortcutsSection } from "./ShortcutsSection";

/**
 * Settings screen.
 *
 * Each section owns one slice of the settings document and writes through the
 * store, which round-trips to Rust and adopts the persisted result — so what is
 * on screen is always what was actually saved.
 */
export function SettingsView() {
  const settings = useSettingsStore((state) => state.settings);
  const status = useSettingsStore((state) => state.status);
  const error = useSettingsStore((state) => state.error);
  const saving = useSettingsStore((state) => state.saving);
  const load = useSettingsStore((state) => state.load);
  const reset = useSettingsStore((state) => state.reset);
  const clearError = useSettingsStore((state) => state.clearError);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Stored locally in your user data directory. API keys live in your system keyring, never
            in the database.
          </p>
        </div>
        {settings ? (
          <Button variant="ghost" disabled={saving} onClick={() => void reset()}>
            Restore defaults
          </Button>
        ) : null}
      </header>

      <ErrorNotice error={error} onRetry={() => void load()} onDismiss={clearError} />

      {status === "loading" && !settings ? <LoadingRow label="Loading settings…" /> : null}

      {settings ? (
        <>
          <AssistantSection settings={settings} />
          <ProvidersSection settings={settings} />
          <AudioSection settings={settings} />
          <ShortcutsSection settings={settings} />
          <PrivacySection settings={settings} />
        </>
      ) : null}
    </div>
  );
}
