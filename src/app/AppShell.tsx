import { useEffect } from "react";
import { Sidebar, type SectionId } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { ProfilesView } from "../features/profiles/ProfilesView";
import { SettingsView } from "../features/settings/SettingsView";
import { useTheme } from "../hooks/useTheme";
import { useSettingsStore } from "../stores/settings";
import type { AppInfo } from "../types/ipc";
import { DashboardView } from "./DashboardView";
import { PlaceholderView } from "./PlaceholderView";

interface AppShellProps {
  appInfo: AppInfo | null;
  bridgeError: string | null;
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
}

export function AppShell({ appInfo, bridgeError, section, onSectionChange }: AppShellProps) {
  const loadSettings = useSettingsStore((state) => state.load);

  // Settings are needed app-wide (theme, active profile, provider state), so
  // they load once here rather than in each view that happens to need them.
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useTheme();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar active={section} onSelect={onSectionChange} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar appInfo={appInfo} bridgeError={bridgeError} />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <SectionContent section={section} onNavigate={onSectionChange} />
        </main>
      </div>
    </div>
  );
}

function SectionContent({
  section,
  onNavigate,
}: {
  section: SectionId;
  onNavigate: (section: SectionId) => void;
}) {
  switch (section) {
    case "dashboard":
      return <DashboardView onNavigate={onNavigate} />;
    case "profiles":
      return <ProfilesView />;
    case "settings":
      return <SettingsView />;
    default:
      return <PlaceholderView section={section} />;
  }
}
