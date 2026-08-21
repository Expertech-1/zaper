/** Detects whether we are running inside a Tauri webview or a plain browser. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
