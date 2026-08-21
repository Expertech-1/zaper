import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DraftTextField } from "../../components/ui/DraftTextField";
import { ErrorNotice } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/Field";
import { IpcError, toIpcError } from "../../lib/errors";
import {
  deleteProviderCredential,
  listCredentialStatus,
  setProviderCredential,
} from "../../services/settings";
import { useSettingsStore } from "../../stores/settings";
import {
  PROVIDER_CAPABILITIES,
  providerRequiresCredential,
  providerRequiresEndpoint,
  type CredentialStatus,
  type ProviderCapability,
  type ProviderConfig,
  type ProviderKind,
  type Settings,
} from "../../types/ipc";
import { SettingsSection } from "./SettingsSection";

const PROVIDER_OPTIONS = [
  { value: "mock", label: "Mock — offline, no API key" },
  { value: "openAi", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "openAiCompatible", label: "OpenAI-compatible endpoint" },
] as const;

const CAPABILITY_LABELS: Record<ProviderCapability, { title: string; detail: string }> = {
  llm: { title: "Language model", detail: "Generates answers." },
  stt: { title: "Speech-to-text", detail: "Transcribes microphone and system audio." },
  tts: { title: "Text-to-speech", detail: "Reads answers aloud when enabled." },
  vision: { title: "Vision", detail: "Reads questions from a screen capture." },
};

/**
 * AI provider configuration and credential management.
 *
 * Each capability is configured independently, so speech can come from one
 * vendor and reasoning from another. Credentials are handled by the OS keyring
 * and are write-only from here: a stored key can be replaced or removed, never
 * displayed.
 */
export function ProvidersSection({ settings }: { settings: Settings }) {
  const patch = useSettingsStore((state) => state.patch);
  const saving = useSettingsStore((state) => state.saving);

  const [statuses, setStatuses] = useState<CredentialStatus[]>([]);
  const [credentialError, setCredentialError] = useState<IpcError | null>(null);

  const refreshStatuses = useCallback(async () => {
    try {
      setStatuses(await listCredentialStatus());
      setCredentialError(null);
    } catch (cause) {
      // A missing or locked keyring must not break the settings screen; the
      // provider selectors stay usable and the problem is reported inline.
      setCredentialError(toIpcError(cause));
    }
  }, []);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses, settings.providers]);

  const updateCapability = (capability: ProviderCapability, changes: Partial<ProviderConfig>) => {
    void patch({
      providers: {
        ...settings.providers,
        [capability]: { ...settings.providers[capability], ...changes },
      },
    });
  };

  const configuredProviders = new Set(
    statuses.filter((status) => status.configured).map((status) => status.provider),
  );

  const providersNeedingKeys = [
    ...new Set(
      PROVIDER_CAPABILITIES.map((capability) => settings.providers[capability].provider).filter(
        providerRequiresCredential,
      ),
    ),
  ];

  return (
    <SettingsSection
      title="AI providers"
      detail="Zaper uses cloud AI only — nothing is inferred locally. Configure each capability separately; the mock provider keeps the app fully usable offline."
    >
      <ErrorNotice
        error={credentialError}
        onRetry={() => void refreshStatuses()}
        onDismiss={() => setCredentialError(null)}
      />

      {PROVIDER_CAPABILITIES.map((capability) => {
        const config = settings.providers[capability];
        const labels = CAPABILITY_LABELS[capability];

        return (
          <div
            key={capability}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <div>
              <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                {labels.title}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{labels.detail}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Provider"
                options={PROVIDER_OPTIONS}
                value={config.provider}
                disabled={saving}
                onChange={(event) =>
                  updateCapability(capability, { provider: event.target.value as ProviderKind })
                }
              />

              <DraftTextField
                label="Model"
                value={config.model}
                disabled={saving || !providerRequiresCredential(config.provider)}
                placeholder={
                  providerRequiresCredential(config.provider) ? "model identifier" : "not needed"
                }
                onCommit={(model) => updateCapability(capability, { model })}
              />
            </div>

            {providerRequiresEndpoint(config.provider) ? (
              <DraftTextField
                label="Endpoint"
                type="url"
                hint="Base URL of your gateway, e.g. https://gateway.example.com/v1"
                value={config.endpoint ?? ""}
                disabled={saving}
                onCommit={(endpoint) =>
                  updateCapability(capability, { endpoint: endpoint || null })
                }
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <DraftTextField
                label="Timeout (seconds)"
                type="number"
                value={String(config.timeoutSecs)}
                disabled={saving}
                onCommit={(value) =>
                  updateCapability(capability, { timeoutSecs: Number(value) || 0 })
                }
              />
              <DraftTextField
                label="Temperature"
                type="number"
                hint="Blank uses the provider default."
                value={config.temperature === null ? "" : String(config.temperature)}
                disabled={saving}
                onCommit={(value) =>
                  updateCapability(capability, {
                    temperature: value.trim() === "" ? null : Number(value),
                  })
                }
              />
              <DraftTextField
                label="Max output tokens"
                type="number"
                hint="Blank follows the answer-length setting."
                value={config.maxOutputTokens === null ? "" : String(config.maxOutputTokens)}
                disabled={saving}
                onCommit={(value) =>
                  updateCapability(capability, {
                    maxOutputTokens: value.trim() === "" ? null : Number(value),
                  })
                }
              />
            </div>
          </div>
        );
      })}

      {providersNeedingKeys.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div>
            <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">API keys</h3>
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Stored in your system keyring (GNOME Keyring or KWallet), never in Zaper&apos;s
              database or config files. Keys cannot be read back — only replaced or removed.
            </p>
          </div>

          {providersNeedingKeys.map((provider) => (
            <CredentialRow
              key={provider}
              provider={provider}
              configured={configuredProviders.has(provider)}
              onChanged={() => void refreshStatuses()}
              onError={setCredentialError}
            />
          ))}
        </div>
      ) : null}
    </SettingsSection>
  );
}

function CredentialRow({
  provider,
  configured,
  onChanged,
  onError,
}: {
  provider: ProviderKind;
  configured: boolean;
  onChanged: () => void;
  onError: (error: IpcError) => void;
}) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const label = PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;

  const save = async () => {
    setBusy(true);
    try {
      await setProviderCredential(provider, secret);
      // Clear immediately so the key does not linger in component state or in a
      // React DevTools snapshot.
      setSecret("");
      onChanged();
    } catch (cause) {
      onError(toIpcError(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteProviderCredential(provider);
      onChanged();
    } catch (cause) {
      onError(toIpcError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <label
          htmlFor={`credential-${provider}`}
          className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
        <input
          id={`credential-${provider}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={secret}
          disabled={busy}
          placeholder={configured ? "•••••••• stored — type to replace" : "paste your API key"}
          onChange={(event) => setSecret(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <Button
        variant="secondary"
        disabled={busy || secret.trim().length === 0}
        onClick={() => void save()}
      >
        {configured ? "Replace" : "Save"}
      </Button>

      {configured ? (
        <Button variant="ghost" disabled={busy} onClick={() => void remove()}>
          Remove
        </Button>
      ) : (
        <span className="pb-1.5 text-[11px] text-amber-700 dark:text-amber-400">not set</span>
      )}
    </div>
  );
}
