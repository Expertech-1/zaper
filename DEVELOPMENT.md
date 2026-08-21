# Development

Practical notes for developing **Zaper** on Ubuntu.

## Prerequisites

See [`README.md`](./README.md) §Prerequisites for system dependencies, Rust and
Node/pnpm setup. The short version:

```bash
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libpipewire-0.3-dev libspa-0.2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm install -g pnpm@latest
```

## Running the app

```bash
pnpm install
pnpm tauri dev
```

`pnpm tauri dev` starts the Vite dev server (port 1420) and compiles/runs the
Rust binary. For frontend-only work, `pnpm dev` and open `http://localhost:1420`
(the IPC falls back to static values so the UI renders without Rust).

## Project layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Key M0 files:

- `src/types/ipc.ts` — IPC contract (single source of truth).
- `src/services/ipc.ts` — typed wrappers.
- `src-tauri/src/commands/` — Rust command modules.
- `src-tauri/capabilities/` — Tauri permission scopes.

## Adding an IPC command (M0 pattern)

1. Add the command fn in `src-tauri/src/commands/<feature>.rs` and register it
   in `src-tauri/src/lib.rs`.
2. Add its result schema in `src/types/ipc.ts` and register in
   `commandRegistry`.
3. Add a typed wrapper in `src/services/`.
4. Add a capability permission if the command needs one.

## Audio (M3 plan)

- Primary backend: **PipeWire** via the `pipewire` crate (mic + system audio).
  System audio is captured by creating a virtual null-sink adapter node and
  reading its monitor.
- Fallback backend: **cpal** (microphone only) for non-PipeWire setups.
- Backend auto-selection: prefer PipeWire; fall back to cpal for mic.

## Screen capture (M8 plan)

- **Wayland**: XDG Desktop Portal ScreenCast via `ashpd`/`zbus`.
- **X11**: `xcap`.
- Region selection and global-shortcut support are compositor-dependent; the
  app detects and reports unsupported capabilities rather than faking them.

## Formatting & linting

```bash
pnpm format        # prettier --write
pnpm lint          # eslint
cd src-tauri && cargo fmt && cargo clippy -- -D warnings
```

## Troubleshooting

- **`webkit2gtk-4.1` missing** — install system deps, then rebuild.
- **Port 1420 busy** — free the port; `strictPort` is enabled.
- **pnpm skips esbuild build** — allowed builds are in `pnpm-workspace.yaml`.
- **Wayland global shortcut doesn't register** — compositor limitation; use the
  in-app fallback.
