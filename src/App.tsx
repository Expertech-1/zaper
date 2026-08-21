import { useEffect, useState } from "react";
import { AppShell } from "./app/AppShell";
import type { SectionId } from "./components/layout/Sidebar";
import { getAppInfo } from "./services/app";
import type { AppInfo } from "./types/ipc";

export default function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("dashboard");

  useEffect(() => {
    let cancelled = false;

    getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBridgeError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      appInfo={appInfo}
      bridgeError={bridgeError}
      section={section}
      onSectionChange={setSection}
    />
  );
}
