# Zaper — Personal AI Interview, Meeting & Research Copilot

**Zaper** is a private, single-user **Ubuntu desktop application** for AI interview
practice, meeting transcription, and research assistance. It is built with
**Tauri 2 (Rust)** + **React 19 (TypeScript)** and uses **cloud AI providers**
(OpenAI, Anthropic, Google Gemini, OpenAI-compatible gateways such as DeepSeek)
for speech-to-text, LLM inference, vision, and text-to-speech.

> **Status: M0 — Scaffold.** The app shell, typed React ↔ Rust IPC bridge, and
> build pipeline are in place. Feature milestones (profiles, AI, audio,
> assistant, meetings…) are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

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

## Verification commands

```bash
pnpm typecheck        # tsc --noEmit (src + tooling configs)
pnpm lint             # ESLint
pnpm format:check     # Prettier
pnpm test             # Vitest
pnpm build            # tsc && vite build
cd src-tauri && cargo fmt --check && cargo clippy && cargo check
```

## Production build

```bash
pnpm tauri build      # produces .deb and AppImage under src-tauri/target/release/bundle/
```

---

## Project layout (M0)

```
src/                  React frontend (feature-first)
  app/                app shell, views
  components/         layout + reusable UI
  hooks/              shared hooks (theme, Tauri events, …)
  lib/                helpers (env detection)
  services/           typed IPC wrappers around Tauri commands
  stores/             Zustand stores
  test/               test setup
  types/              domain models + centralized IPC contract
src-tauri/            Rust / Tauri core
  src/commands/       IPC command modules (mirror src/types/ipc.ts)
  capabilities/       Tauri capability/permission scopes
scripts/              tooling (icon generation, …)
```

---

## Roadmap

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §Roadmap for the full milestone plan.
Short version: M0 scaffold (current) → SQLite + profiles → AI providers →
audio + STT → question detection → floating assistant → TTS → documents/RAG →
screen reading → meetings → meeting search → hardening/packaging.

## Troubleshooting

- **`webkit2gtk-4.1` not found during `cargo build`** — install the system
  dependencies listed above, then retry.
- **Port 1420 in use** — `pnpm tauri dev` requires port 1420 to be free
  (`strictPort` is on).
- **pnpm ignores esbuild build script** — the approved build list is in
  `pnpm-workspace.yaml` (`allowBuilds.esbuild: true`).
- **Audio capture fails** — Zaper uses PipeWire for system audio; see
  [`DEVELOPMENT.md`](./DEVELOPMENT.md) §Audio.

## License

Private project. All rights reserved.
