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
Rust binary.

For frontend-only work, `pnpm dev` and open `http://localhost:1420`. With no
Tauri runtime present the UI falls back to an in-memory preview backend
(`src/services/devBackend.ts`), so profiles and settings are fully clickable
without compiling Rust. Preview state lives in memory and disappears on reload —
that is deliberate, so nobody mistakes it for the real app.

## Verification gate

Run before considering any change done:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Project layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Key files:

| Path                         | Role                                              |
| ---------------------------- | ------------------------------------------------- |
| `src/types/ipc.ts`           | IPC contract — single source of truth             |
| `src/services/ipc.ts`        | typed transport (validates results, types errors) |
| `src/services/devBackend.ts` | in-memory preview backend (no Tauri)              |
| `src-tauri/src/error.rs`     | error taxonomy (`AppError` → `IpcError`)          |
| `src-tauri/src/domain/`      | pure types + validation, no I/O                   |
| `src-tauri/src/repo/`        | the only place that writes SQL                    |
| `src-tauri/src/commands/`    | thin IPC surface                                  |
| `src-tauri/migrations/`      | versioned schema                                  |
| `src-tauri/capabilities/`    | Tauri permission scopes                           |

## Dependencies and why

Do not add a crate or package without recording the reason here.

| Dependency                | Why                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlx` (sqlite, migrate)  | Async SQLite with versioned, embedded migrations. TLS off — a local file has no transport to secure.                                        |
| `tokio`                   | Matches Tauri's runtime; used for our own tasks, bounded channels (M3) and timers.                                                          |
| `keyring`                 | OS credential storage. `sync-secret-service` + `crypto-rust` speaks Secret Service in pure Rust, so packaging needs no libsecret C library. |
| `uuid`, `chrono`          | Entity ids and RFC 3339 timestamps.                                                                                                         |
| `tracing`(+`-subscriber`) | Structured diagnostics, filtered by `ZAPER_LOG`.                                                                                            |
| `thiserror`               | Error taxonomy without boilerplate.                                                                                                         |
| `zod`                     | Validates every IPC result and (from M2) all structured AI output.                                                                          |
| `zustand`                 | Small predictable stores; no context/provider ceremony.                                                                                     |

We deliberately do **not** use `sqlx`'s compile-time query macros — see
ARCHITECTURE.md §5 for why.

## Adding an IPC command

1. **Domain** — add or extend the types and validation in
   `src-tauri/src/domain/`. Validation belongs here, not in the command.
2. **Repository** — add the SQL in `src-tauri/src/repo/`. Multi-step writes go in
   a transaction. Return domain types, never `sqlx` types.
3. **Command** — add a thin `#[tauri::command]` in `src-tauri/src/commands/`
   returning `CommandResult<T>`, and register it in `src-tauri/src/lib.rs`.
4. **Contract** — add the result schema to `src/types/ipc.ts` and register it in
   `commandRegistry`.
5. **Service** — add a wrapper in `src/services/<feature>.ts` that calls
   `callCommand`.
6. **Preview** — add a handler in `src/services/devBackend.ts` if the UI needs to
   work without Rust.
7. **Capability** — grant a permission in `src-tauri/capabilities/` only if the
   command genuinely needs one.
8. **Tests** — repository tests in Rust, mapping/behaviour tests in Vitest.

## Working with the database

The database is created at first launch in `~/.local/share/dev.zaper.app/zaper.db`.

```bash
sqlite3 ~/.local/share/dev.zaper.app/zaper.db '.tables'
rm ~/.local/share/dev.zaper.app/zaper.db*   # reset; migrations rerun on next launch
```

Migrations are embedded into the binary, applied at startup, and must be
append-only: add `000N_description.sql`, never edit an applied migration.

Rust tests use a real SQLite database (in-memory for repositories, a temp file for
the on-disk path), so the SQL is exercised rather than mocked.

## Credentials

API keys go to the OS keyring under the service `dev.zaper.app`, one entry per
provider. Inspect them with Seahorse, or:

```bash
secret-tool search --all service dev.zaper.app
```

There is no command that returns a key to the frontend — keys are write-only from
the UI's perspective. Only Rust-side provider adapters read the plaintext.

If no keyring daemon is running (headless session, minimal container), credential
operations fail with a `credential` error explaining how to fix it. They never
silently fall back to plaintext storage.

## Logging

```bash
ZAPER_LOG=zaper_lib=debug pnpm tauri dev
```

Logged: lifecycle, errors, provider failures, timings, audio/database problems.
Never logged by default: raw audio, transcripts, document contents, prompts, API
keys.

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
cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings
```

Rust formatting is configured in `src-tauri/rustfmt.toml`: 100 columns to match
Prettier's `printWidth`, and compact struct literals.

## Troubleshooting

- **`webkit2gtk-4.1` missing** — install system deps, then rebuild.
- **Port 1420 busy** — free the port; `strictPort` is enabled.
- **pnpm skips esbuild build** — allowed builds are in `pnpm-workspace.yaml`.
- **"Zaper could not reach your system keyring"** — start/unlock GNOME Keyring or
  KWallet. On a headless session there is no Secret Service at all.
- **Settings look reset** — a stored settings document that fails validation is
  ignored in favour of defaults, with a warning in the log. Check the log rather
  than guessing.
- **Wayland global shortcut doesn't register** — compositor limitation; leave the
  binding empty and use the in-app control.
