# Architecture

> **Zaper** — a Linux-first, private desktop AI copilot (Tauri 2 + React 19).
> This document is the living architecture reference. It grows with each
> milestone.

## 1. Overview

```
                     UBUNTU
                        |
            +-----------+-----------+
            |                       |
            v                       v
      React/TypeScript         Rust/Tauri
            |                       |
            |      typed IPC        |
            +-----------+-----------+
                        |
                        v
                  Core Services
                        |
        +---------------+----------------+
        |               |                |
        v               v                v
      Audio          Screen           SQLite
        |               |
        v               v
       Cloud AI Providers
        |
   +----+----+---------+
   |    |    |         |
   v    v    v         v
  STT  LLM  TTS   Vision
```

**Division of responsibility**

- **React** — presentation and user interaction only.
- **Rust** — OS integration, audio capture (PipeWire + cpal), microphone,
  screen capture (portals/X11), global shortcuts, native windows, tray,
  SQLite persistence, keyring access, and any secure/native operation.
- **Cloud** — speech recognition, LLM inference, vision, text-to-speech.

Linux-specific details never leak into React. React talks to well-defined,
typed Tauri commands and listens to well-defined Tauri events.

## 2. Frontend

- **React 19 + TypeScript (strict)** — no `any`, no JS for app logic.
- **Vite** dev/build, **Tailwind CSS v4** (class-based dark mode).
- **Zustand** for state (theme today; settings/assistant/meeting stores later).
- **Zod** validates data at the IPC boundary and any AI/structured input.

Layout (M0):

```
src/
  app/         shell + views (Dashboard, PlaceholderView)
  components/  layout/ (Sidebar, Topbar) + ui/ (Button)
  hooks/       useTheme
  lib/         env detection (isTauri)
  services/    typed IPC wrappers
  stores/      theme (Zustand + persist)
  test/        setup
  types/       ipc.ts — the IPC contract (single source of truth)
```

## 3. IPC contract

`src/types/ipc.ts` is the **single source of truth** for command names, payload
shapes and (soon) event names. Rust command modules under `src-tauri/src/commands/`
mirror it 1:1. Frontend code never calls `invoke("...")` with ad-hoc strings;
it uses typed wrappers in `src/services/`.

Commands (M0): `get_app_info`.

Upcoming commands/events (from the product spec) include: audio capture
control, transcript partial/final events, question detection, streaming answer
events (`answer_started` / `answer_token` / `answer_completed`), meeting
controls, profile/document CRUD, screen capture, settings.

## 4. Rust core

- `src/main.rs` — binary entry (`zaper_lib::run()`).
- `src/lib.rs` — Tauri builder, command registration.
- `src/commands/` — one module per feature.
- `capabilities/default.json` — minimal permissions (M0). Permissions are
  added feature-by-feature; **no** arbitrary filesystem or shell access is
  exposed to the frontend.

## 5. Data layer (planned, M1)

SQLite via **sqlx** (async, compile-time-checked, versioned migrations under
`src-tauri/migrations/`). Planned tables: `profiles`, `profile_experiences`,
`profile_projects`, `profile_stories`, `interviews`, `interview_documents`,
`documents`, `document_chunks`, `conversations`, `conversation_messages`,
`meetings`, `meeting_segments`, `meeting_action_items`, `settings`,
`ai_usage`, `app_events`. Secrets are **never** stored in SQLite — they live in
the OS keyring (Secret Service).

## 6. AI provider abstraction (planned, M2)

Traits: `LLMProvider`, `SpeechToTextProvider`, `VisionProvider`, `TTSProvider`.
Adapters: OpenAI, Anthropic, Google Gemini, OpenAI-compatible (DeepSeek &
gateways). Mock providers for offline testing. Prompts are versioned and
centralized (never scattered through components).

## 7. Audio (planned, M3)

PipeWire-first (mic + system audio via virtual null-sink) with a cpal fallback
for microphone on non-PipeWire setups. Bounded buffers, cancellation,
typed error events. Streaming STT → transcript events → question detection.

## 8. Screen capture (planned, M8)

`ScreenCapture` trait with two backends: **XDG Desktop Portal** (Wayland/GNOME,
via `ashpd`) and **X11** (`xcap`). Limitations are detected and surfaced —
we never fake unsupported capabilities.

## 9. Security & privacy model

See [`SECURITY.md`](./SECURITY.md) and [`PRIVACY.md`](./PRIVACY.md). Summary:
least-privilege capabilities, no shell execution, no telemetry, secrets in the
keyring, minimal context sent to cloud, no stealth/anti-detection features.

## 10. State machines (planned, M4+)

Assistant and meeting lifecycles are modeled as explicit, testable state
machines (Rust enums with pure transition functions) — no boolean soup.

---

## Roadmap

| Milestone | Scope                                                                       | Depends on |
| --------- | --------------------------------------------------------------------------- | ---------- |
| **M0**    | Scaffold: Tauri + React + strict TS + Tailwind, typed IPC, app boots        | —          |
| M1        | SQLite (sqlx) + settings + profiles + keyring                               | M0         |
| M2        | Provider abstraction, streaming LLM, context engine, prompts, answer length | M1         |
| M3        | PipeWire + cpal audio capture, streaming STT, transcript events             | M1         |
| M4        | Question detection + assistant state machine + conversation memory          | M2, M3     |
| M5        | Floating assistant window, streaming answers, global shortcuts              | M4         |
| M6        | TTS (sentence-buffered) + earpiece mode                                     | M5         |
| M7        | Document import + chunking + retrieval (RAG)                                | M2         |
| M8        | Screen reading + vision + coding screen analysis                            | M2, M5     |
| M9        | Meeting mode: capture, live transcript, summary + action items              | M3, M2     |
| M10       | Meeting search + Q&A with source timestamps                                 | M9         |
| M11       | Harden: error taxonomy, retry/backoff, metrics, onboarding, packaging       | all        |

Each milestone must pass: `cargo test` + `cargo clippy` + `cargo fmt --check` +
`tsc --noEmit` + `eslint` + `prettier --check` + a working `pnpm tauri dev`.
