import { DraftTextField } from "../../components/ui/DraftTextField";
import { useSettingsStore } from "../../stores/settings";
import type { Settings, Shortcuts } from "../../types/ipc";
import { SettingsSection } from "./SettingsSection";

const SHORTCUT_FIELDS: { key: keyof Shortcuts; label: string; detail: string }[] = [
  {
    key: "toggleAssistant",
    label: "Show / hide assistant",
    detail: "Brings the floating window up.",
  },
  { key: "readScreen", label: "Read screen", detail: "Captures a region and analyses it." },
  { key: "toggleMeeting", label: "Toggle meeting mode", detail: "Starts or ends a recording." },
  { key: "toggleListening", label: "Toggle listening", detail: "Starts or stops transcription." },
  {
    key: "regenerateAnswer",
    label: "Regenerate answer",
    detail: "Asks again for the last question.",
  },
];

/**
 * Global shortcut bindings.
 *
 * Registration is done by Rust/Tauri (M5). Leaving a binding empty is a
 * supported choice — some Wayland compositors refuse global registration, and a
 * blank field is honest about that rather than showing a shortcut that silently
 * does nothing.
 */
export function ShortcutsSection({ settings }: { settings: Settings }) {
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  return (
    <SettingsSection
      title="Global shortcuts"
      detail="Use a modifier plus a key, e.g. Ctrl+Shift+S. Leave a field empty to unbind it. On Wayland, whether a global shortcut can be registered depends on your compositor."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SHORTCUT_FIELDS.map(({ key, label, detail }) => (
          <DraftTextField
            key={key}
            label={label}
            hint={detail}
            value={settings.shortcuts[key]}
            disabled={saving}
            onCommit={(value) =>
              void patch({ shortcuts: { ...settings.shortcuts, [key]: value.trim() } })
            }
          />
        ))}
      </div>
    </SettingsSection>
  );
}
