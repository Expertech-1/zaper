import { useEffect } from "react";
import { Button } from "../components/ui/Button";
import { useProfilesStore } from "../stores/profiles";
import { useSettingsStore } from "../stores/settings";
import { providerRequiresCredential } from "../types/ipc";
import type { SectionId } from "../components/layout/Sidebar";

interface DashboardViewProps {
  onNavigate: (section: SectionId) => void;
}

/**
 * Dashboard: what is configured, what is missing, and where to go next.
 *
 * Derived from real state rather than static copy, so it cannot claim the app is
 * ready when it is not.
 */
export function DashboardView({ onNavigate }: DashboardViewProps) {
  const settings = useSettingsStore((state) => state.settings);
  const summaries = useProfilesStore((state) => state.summaries);
  const loadProfiles = useProfilesStore((state) => state.load);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const activeProfile = summaries.find((summary) => summary.isActive) ?? null;
  const llmProvider = settings?.providers.llm.provider ?? "mock";
  const usesCloud = providerRequiresCredential(llmProvider);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Zaper</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your private AI interview, meeting &amp; research copilot for Ubuntu. Everything stays
          local — cloud AI is used only when you ask for it.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          title="Active profile"
          detail={activeProfile ? activeProfile.name : "None selected"}
          tone={activeProfile ? "ok" : "attention"}
        />
        <StatusCard
          title="Language model"
          detail={usesCloud ? `Cloud · ${llmProvider}` : "Mock — offline"}
          tone={usesCloud ? "ok" : "attention"}
        />
        <StatusCard
          title="Answer length"
          detail={settings ? capitalize(settings.answerLength) : "…"}
          tone="ok"
        />
      </section>

      {!activeProfile ? (
        <NextStep
          title="Create a profile"
          detail="A profile holds your real experience, projects and interview stories. Job and coding answers are grounded in it — without one, the assistant will say it lacks information rather than invent any."
          action={
            <Button variant="primary" onClick={() => onNavigate("profiles")}>
              Go to Profiles
            </Button>
          }
        />
      ) : null}

      {!usesCloud ? (
        <NextStep
          title="Connect a cloud AI provider"
          detail="Zaper runs on the mock provider until you configure one, so you can explore the app offline. Add a provider and API key to generate real answers — the key is stored in your system keyring."
          action={
            <Button variant="secondary" onClick={() => onNavigate("settings")}>
              Open Settings
            </Button>
          }
        />
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">What ships next</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Cloud AI providers + streaming answers (M2)</li>
          <li>Microphone &amp; system audio capture with live transcription (M3)</li>
          <li>Question detection and the interview state machine (M4)</li>
          <li>Floating assistant, shortcuts, TTS, documents, meetings…</li>
        </ol>
      </section>
    </div>
  );
}

type Tone = "ok" | "attention";

function StatusCard({ title, detail, tone }: { title: string; detail: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${
            tone === "ok" ? "bg-emerald-500" : "bg-amber-400"
          }`}
        />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <p className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function NextStep({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
      <div>
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
          {detail}
        </p>
      </div>
      {action}
    </section>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
