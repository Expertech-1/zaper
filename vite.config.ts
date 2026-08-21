import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Tauri expects a fixed port and fails if that port is not available.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't let Tauri's Rust watcher trigger rebuilds.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
  },
  test: {
    // Enable globals so @testing-library/react auto-cleans up between tests.
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
