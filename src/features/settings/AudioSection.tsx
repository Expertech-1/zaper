import { DraftTextField } from "../../components/ui/DraftTextField";
import { ToggleField } from "../../components/ui/Field";
import { useSettingsStore } from "../../stores/settings";
import type { Settings } from "../../types/ipc";
import { SettingsSection } from "./SettingsSection";

/**
 * Audio capture and spoken-answer preferences.
 *
 * Device pickers are text fields for now: enumerating PipeWire nodes arrives
 * with the audio backend in M3, and offering an empty dropdown would imply a
 * capability that does not exist yet.
 */
export function AudioSection({ settings }: { settings: Settings }) {
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  return (
    <SettingsSection
      title="Audio"
      detail="Zaper captures audio only while you are listening or recording, and never stores it unless you explicitly enable recording."
    >
      <div className="flex flex-col gap-2.5">
        <ToggleField
          label="Capture microphone"
          hint="Your own voice — needed for interview answers you speak."
          checked={settings.audio.captureMicrophone}
          disabled={saving}
          onChange={(captureMicrophone) =>
            void patch({ audio: { ...settings.audio, captureMicrophone } })
          }
        />
        <ToggleField
          label="Capture system audio"
          hint="What your computer plays — the interviewer's or meeting's side of the conversation."
          checked={settings.audio.captureSystemAudio}
          disabled={saving}
          onChange={(captureSystemAudio) =>
            void patch({ audio: { ...settings.audio, captureSystemAudio } })
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DraftTextField
          label="Microphone device"
          hint="Leave empty for the system default."
          value={settings.audio.microphoneDevice ?? ""}
          disabled={saving}
          onCommit={(value) =>
            void patch({ audio: { ...settings.audio, microphoneDevice: value || null } })
          }
        />
        <DraftTextField
          label="System audio source"
          hint="Leave empty for the default monitor source."
          value={settings.audio.systemAudioSource ?? ""}
          disabled={saving}
          onCommit={(value) =>
            void patch({ audio: { ...settings.audio, systemAudioSource: value || null } })
          }
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <ToggleField
          label="Speak answers aloud"
          hint="Streams each finished sentence to text-to-speech instead of waiting for the whole answer."
          checked={settings.tts.enabled}
          disabled={saving}
          onChange={(enabled) => void patch({ tts: { ...settings.tts, enabled } })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <DraftTextField
            label="Voice"
            hint="Provider-specific voice id."
            value={settings.tts.voice ?? ""}
            disabled={saving || !settings.tts.enabled}
            onCommit={(value) => void patch({ tts: { ...settings.tts, voice: value || null } })}
          />

          <RangeField
            label={`Speed — ${settings.tts.speed.toFixed(2)}×`}
            min={0.5}
            max={2}
            step={0.05}
            value={settings.tts.speed}
            disabled={saving || !settings.tts.enabled}
            onChange={(speed) => void patch({ tts: { ...settings.tts, speed } })}
          />

          <RangeField
            label={`Volume — ${Math.round(settings.tts.volume * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={settings.tts.volume}
            disabled={saving || !settings.tts.enabled}
            onChange={(volume) => void patch({ tts: { ...settings.tts, volume } })}
          />
        </div>
      </div>
    </SettingsSection>
  );
}

function RangeField({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = label.replace(/[^a-z]/gi, "-").toLowerCase();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand-600 disabled:opacity-50"
      />
    </div>
  );
}
