import { DraftTextField } from "../../components/ui/DraftTextField";
import { SelectField } from "../../components/ui/Field";
import { useSettingsStore } from "../../stores/settings";
import { MAX_RESPONSE_DELAY_MS, type Settings } from "../../types/ipc";
import { SettingsSection } from "./SettingsSection";

const MODE_OPTIONS = [
  { value: "research", label: "Research" },
  { value: "job", label: "Job / behavioral" },
  { value: "coding", label: "Coding" },
] as const;

const ANSWER_LENGTH_OPTIONS = [
  { value: "short", label: "Short — 1–3 sentences" },
  { value: "medium", label: "Medium — conversational" },
  { value: "detailed", label: "Detailed — examples and tradeoffs" },
] as const;

const THEME_OPTIONS = [
  { value: "system", label: "Follow desktop" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/** Answering behaviour: mode, length, delay, language, appearance. */
export function AssistantSection({ settings }: { settings: Settings }) {
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  const delaySeconds = (settings.responseDelayMs / 1_000).toFixed(1);

  return (
    <SettingsSection
      title="Assistant"
      detail="How answers are generated. Answer length is a generation parameter, not just a label — it changes the prompt and the token budget."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Default mode"
          options={MODE_OPTIONS}
          value={settings.defaultMode}
          disabled={saving}
          onChange={(event) =>
            void patch({ defaultMode: event.target.value as Settings["defaultMode"] })
          }
        />

        <SelectField
          label="Answer length"
          options={ANSWER_LENGTH_OPTIONS}
          value={settings.answerLength}
          disabled={saving}
          onChange={(event) =>
            void patch({ answerLength: event.target.value as Settings["answerLength"] })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="response-delay"
          className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Wait before answering — {delaySeconds}s
        </label>
        <input
          id="response-delay"
          type="range"
          min={0}
          max={MAX_RESPONSE_DELAY_MS}
          step={100}
          value={settings.responseDelayMs}
          disabled={saving}
          aria-describedby="response-delay-hint"
          onChange={(event) => void patch({ responseDelayMs: Number(event.target.value) })}
          className="w-full accent-brand-600"
        />
        <p id="response-delay-hint" className="text-[11px] text-zinc-500 dark:text-zinc-400">
          How long to keep listening after a question looks complete. Longer waits catch
          trailing words; shorter waits answer sooner.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DraftTextField
          label="Language"
          hint="A language tag such as en, en-GB or fr — or “auto” to let the provider detect it."
          value={settings.language}
          disabled={saving}
          onCommit={(language) => void patch({ language })}
        />

        <SelectField
          label="Appearance"
          options={THEME_OPTIONS}
          value={settings.theme}
          disabled={saving}
          onChange={(event) => void patch({ theme: event.target.value as Settings["theme"] })}
        />
      </div>
    </SettingsSection>
  );
}
