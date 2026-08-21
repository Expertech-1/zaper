import { ToggleField } from "../../components/ui/Field";
import { useSettingsStore } from "../../stores/settings";
import { PROVIDER_CAPABILITIES, providerRequiresCredential, type Settings } from "../../types/ipc";
import { SettingsSection } from "./SettingsSection";

/**
 * Privacy panel.
 *
 * The spec requires a clear, in-app explanation of exactly what leaves the
 * machine (spec §26). This renders that from the actual configuration rather
 * than from static copy, so it cannot drift from what the app really does.
 */
export function PrivacySection({ settings }: { settings: Settings }) {
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  const cloudCapabilities = PROVIDER_CAPABILITIES.filter((capability) =>
    providerRequiresCredential(settings.providers[capability].provider),
  );

  return (
    <SettingsSection
      title="Privacy & diagnostics"
      detail="Zaper is local-first: no analytics, no telemetry, no background uploads, no cloud sync."
    >
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-950/40">
        <h3 className="font-semibold text-zinc-700 dark:text-zinc-200">
          What is sent to cloud AI
        </h3>

        {cloudCapabilities.length === 0 ? (
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Nothing. Every capability is set to the mock provider, so no data leaves this machine.
          </p>
        ) : (
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-zinc-600 dark:text-zinc-400">
            {cloudCapabilities.includes("stt") ? (
              <li>Captured audio, while you are listening or recording, for transcription.</li>
            ) : null}
            {cloudCapabilities.includes("llm") ? (
              <li>
                The current question, recent conversation turns, and the relevant parts of your
                active profile and documents — not whole files, and not your entire history.
              </li>
            ) : null}
            {cloudCapabilities.includes("vision") ? (
              <li>Screen captures you explicitly trigger, discarded after processing.</li>
            ) : null}
            {cloudCapabilities.includes("tts") ? (
              <li>Answer text, to be synthesized into speech.</li>
            ) : null}
          </ul>
        )}

        <p className="mt-2 text-zinc-500 dark:text-zinc-500">
          Profiles, documents, transcripts, meetings and settings are stored only on this computer.
        </p>
      </div>

      <ToggleField
        label="Diagnostic logging"
        hint="Verbose local logs for troubleshooting. Even when enabled, Zaper does not log API keys, raw audio or full transcripts. Logs stay on this machine."
        checked={settings.diagnosticLogging}
        disabled={saving}
        onChange={(diagnosticLogging) => void patch({ diagnosticLogging })}
      />
    </SettingsSection>
  );
}
