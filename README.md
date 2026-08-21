# Zaper — Personal AI Interview, Meeting & Research Copilot

**Zaper** is a private, single-user **Ubuntu desktop application** for AI interview
practice, meeting transcription, and research assistance. It is built with
**Tauri 2 (Rust)** + **React 19 (TypeScript)** and uses **cloud AI providers**
(OpenAI, Anthropic, Google Gemini, OpenAI-compatible gateways such as DeepSeek)
for speech-to-text, LLM inference, vision, and text-to-speech.

> **Status: M1 — Local data layer.** The app shell and typed React ↔ Rust IPC
> bridge are in place, on top of a versioned SQLite schema with working profiles,
> settings, an error taxonomy, and API keys stored in the OS keyring. AI
> inference, audio and the assistant window land in the next milestones — see
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) §Roadmap.
>
> A fresh install runs entirely offline on a built-in mock provider, so you can
> explore profiles and settings before configuring any cloud account.

---

## Highlights

- **Local-first & private** — profiles, documents, settings, conversations and
  meetings live in a local SQLite database. No analytics, no telemetry, no
  cloud sync.
- **Transparent AI usage** — only the minimum necessary context is sent to the
  cloud provider you configure. See [`PRIVACY.md`](./PRIVACY.md).
- **Cloud AI only** — no local LLM. Providers are behind clean adapters so you
  can switch models/providers from Settings.
- **Linux-first** — targets Ubuntu 24.04 LTS (X11 and Wayland), with audio via
  **PipeWire** (cpal fallback for microphone).

---

## Prerequisites

| Dependency        | Version           | Notes                          |
| ----------------- | ----------------- | ------------------------------ |
| Ubuntu            | 24.04 LTS+        | Primary target (X11 & Wayland) |
| Node.js           | ≥ 20              | LTS recommended                |
| pnpm              | ≥ 9               | Package manager                |
| Rust              | stable (≥ 1.77.2) | Via rustup                     |
| Tauri system libs | —                 | See below                      |

## Ubuntu system dependencies

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libpipewire-0.3-dev \
  libspa-0.2-dev
```

## Rust setup (user-level, no sudo)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustup component add clippy rustfmt
```

## Node & pnpm setup

```bash
# Node ≥ 20 (e.g. via nvm). pnpm:
npm install -g pnpm@latest
```

## Development commands

```bash
pnpm install          # install frontend dependencies
pnpm tauri dev        # run the desktop app (starts Vite + Rust)
```

Frontend-only development (no Rust): `pnpm dev`, then open `http://localhost:1420`.
The UI runs against an in-memory preview backend, so screens are clickable
without compiling Rust. Preview data is not persisted.

## Where your data lives

| Path                            | Contents                         |
| ------------------------------- | -------------------------------- |
| `~/.local/share/dev.zaper.app/` | `zaper.db`, imported documents   |
| `~/.cache/dev.zaper.app/`       | temporary files (safe to delete) |
| `~/.local/state/dev.zaper.app/` | logs                             |
| OS keyring (`dev.zaper.app`)    | API keys — never in the database |

Nothing is written into the project directory, and nothing is uploaded anywhere.

## AI provider configuration

Open **Settings → AI providers**. Each capability (language model,
speech-to-text, text-to-speech, vision) is configured separately, so you can mix
vendors. Leave a capability on **Mock** to keep it fully offline.

API keys are stored in your system keyring (GNOME Keyring or KWallet) and cannot
be read back by the app's interface — only replaced or removed. This requires a
running, unlocked keyring daemon; Zaper never falls back to plaintext storage.

## Verification commands

```bash
pnpm typecheck        # tsc --noEmit (src + tooling configs)
pnpm lint             # ESLint
pnpm format:check     # Prettier
pnpm test             # Vitest
pnpm build            # tsc && vite build
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Production build

```bash
pnpm tauri build      # produces .deb and AppImage under src-tauri/target/release/bundle/
```

---

## Project layout

```
src/                  React frontend (feature-first)
  app/                app shell, dashboard
  components/         layout + reusable UI primitives
  features/           one folder per feature (profiles/, settings/)
  hooks/              shared hooks (theme, …)
  lib/                helpers (env, errors, list/text, theme cache)
  services/           typed IPC transport + per-feature wrappers
  stores/             Zustand stores (settings, profiles)
  test/               test setup
  types/              centralized IPC contract (ipc.ts)
src-tauri/            Rust / Tauri core
  migrations/         versioned SQLite schema
  src/commands/       IPC command modules (mirror src/types/ipc.ts)
  src/domain/         typed models + validation (no I/O)
  src/repo/           SQL access
  src/services/       OS integration (keyring)
  src/db/             pool + migrations
  src/error.rs        error taxonomy
  capabilities/       Tauri capability/permission scopes
scripts/              tooling (icon generation, …)
```

---

## Roadmap

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §Roadmap for the full milestone plan.
Short version: M0 scaffold → **M1 SQLite + profiles + settings (current)** → AI
providers → audio + STT → question detection → floating assistant → TTS →
documents/RAG → screen reading → meetings → meeting search → hardening/packaging.

## Troubleshooting

- **`webkit2gtk-4.1` not found during `cargo build`** — install the system
  dependencies listed above, then retry.
- **Port 1420 in use** — `pnpm tauri dev` requires port 1420 to be free
  (`strictPort` is on).
- **pnpm ignores esbuild build script** — the approved build list is in
  `pnpm-workspace.yaml` (`allowBuilds.esbuild: true`).
- **"Zaper could not reach your system keyring"** — start and unlock GNOME
  Keyring or KWallet; a headless session has no Secret Service.
- **Audio capture fails** — Zaper uses PipeWire for system audio; see
  [`DEVELOPMENT.md`](./DEVELOPMENT.md) §Audio.

## License

Private project. All rights reserved.
