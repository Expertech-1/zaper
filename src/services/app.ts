/** App metadata. */

import { callCommand } from "./ipc";
import type { AppInfo } from "../types/ipc";

/** Returns metadata about the running app (name, version, runtime, platform). */
export async function getAppInfo(): Promise<AppInfo> {
  return callCommand("get_app_info");
}
