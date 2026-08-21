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
- **Zustand** for state (settings and profiles today; assistant/meeting later).
- **Zod** validates data at the IPC boundary and any AI/structured input.

Layout (M1):

```
src/
  app/         shell + dashboard + placeholder views
  components/  layout/ (Sidebar, Topbar) + ui/ (Button, Field, Feedback, …)
  features/    one folder per feature: profiles/, settings/
  hooks/       useTheme
  lib/         env detection, error normalization, list/text helpers, theme cache
  services/    typed IPC transport + one wrapper module per feature
  stores/      settings, profiles (Zustand)
  test/        setup
  types/       ipc.ts — the IPC contract (single source of truth)
```

Feature folders own their views and their form mapping (e.g.
`features/profiles/profileForm.ts` converts between the editor's flat strings and
the domain payload) so that mapping is unit-testable without rendering.

**Browser preview.** `services/devBackend.ts` is an in-memory stand-in used only
when no Tauri runtime is present (`pnpm dev` in a plain browser, component
tests). It is not a second implementation of the domain: Rust owns validation and
persistence, and the stand-in reproduces only the few user-visible rules whose
absence would make the preview misleading.

## 3. IPC contract

`src/types/ipc.ts` is the **single source of truth** for command names, payload
shapes and (soon) event names. Rust command modules under
`src-tauri/src/commands/` mirror it 1:1. Frontend code never calls `invoke("...")`
with ad-hoc strings; it goes through `services/ipc.ts`, which

1. validates every result against the command's Zod schema, so contract drift
   fails loudly instead of surfacing as `undefined` in a component, and
2. normalizes every rejection into a typed `IpcError` carrying the Rust
   `ErrorKind`, so callers branch on category rather than message text.

Commands (M1):

| Group       | Commands                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| App         | `get_app_info`                                                                                                                                        |
| Settings    | `get_settings`, `update_settings`, `reset_settings`                                                                                                   |
| Profiles    | `list_profiles`, `get_profile`, `get_active_profile`, `create_profile`, `update_profile`, `duplicate_profile`, `delete_profile`, `set_active_profile` |
| Credentials | `set_provider_credential`, `get_credential_status`, `list_credential_status`, `delete_provider_credential`                                            |

Upcoming commands/events (from the product spec) include: audio capture control,
transcript partial/final events, question detection, streaming answer events
(`answer_started` / `answer_token` / `answer_completed`), meeting controls,
document import, and screen capture.

## 4. Rust core

Layering, outermost first. Dependencies point inward; `domain` depends on nothing
but `error`.

```
commands/   thin IPC surface exposed to React
services/   OS integration (keyring today; audio, screen, shortcuts later)
repo/       SQL — the only place that talks to the database
domain/     pure types + validation, no I/O
db/         connection pool + migrations
error/      error taxonomy shared by every layer
```

- `src/main.rs` — binary entry (`zaper_lib::run()`).
- `src/lib.rs` — Tauri builder, DB bootstrap, command registration.
- `src/state.rs` — `AppState` (handles only, no global mutable business state).
- `src/logging.rs` — `tracing` setup, filtered by `ZAPER_LOG`.
- `capabilities/default.json` — minimal permissions. Permissions are added
  feature-by-feature; **no** arbitrary filesystem or shell access is exposed.

### Error taxonomy

`AppError` is the rich internal error (keeps SQL/IO/D-Bus detail for the logs).
`IpcError` is the wire shape: `{ kind, message, retryable }`. The conversion
happens once, at the boundary, and is the single place that logs the technical
cause — so no call site has to remember to. `kind` lets the UI distinguish
validation / not-found / database / credential / io / network / provider /
unsupported / cancelled / internal, as the spec requires.

## 5. Data layer

SQLite via **sqlx**, with versioned migrations in `src-tauri/migrations/` embedded
into the binary by `sqlx::migrate!`. Applied at startup, before any window is
shown.

Conventions:

- UUIDv4 `TEXT` primary keys; RFC 3339 UTC `TEXT` timestamps (sortable).
- Structured children get real tables and foreign keys; flat value lists (skills,
  tags) are JSON arrays in a `TEXT` column.
- Enum-like columns carry `CHECK` constraints, so bad data cannot land even if a
  future caller skips validation.
- `PRAGMA foreign_keys = ON` per connection; WAL journaling so UI reads proceed
  during writes.

Tables (migration `0001_init`): `settings`, `profiles`, `profile_experiences`,
`profile_projects`, `profile_stories`, `interviews`, `documents`,
`interview_documents`, `document_chunks`, `conversations`,
`conversation_messages`, `meetings`, `meeting_segments`,
`meeting_action_items`, `ai_usage`, `app_events`.

> **Why the runtime query API, not `sqlx::query!`** — the compile-time macros need
> a live database or a committed offline cache during `cargo build`, which makes
> clean builds and CI fragile for an app whose database is created at first
> launch. The SQL is covered by integration tests against a real database
> instead.

Secrets are **never** in SQLite. API keys live in the OS keyring
(`services/keyring.rs`, Secret Service over D-Bus in pure Rust) and are
write-only from the frontend's perspective: there is no command that returns a
key.

### Settings

Stored as one JSON document in the `settings` key/value table. Every field has a
serde default, so a document written by an older build still loads after new
preferences are added — no migration per setting. Reads validate what they load
and fall back to defaults with a warning rather than refusing to start, so a
hand-edited row cannot brick the app. Partial updates load-merge-validate-write
inside a transaction.

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
via `ashpd`) and **X11** (`xcap`).

## 9. Security & privacy model

See [`SECURITY.md`](./SECURITY.md) and [`PRIVACY.md`](./PRIVACY.md). Summary:
least-privilege capabilities, no shell execution, no telemetry, secrets in the
keyring, minimal context sent to cloud.

## 10. State machines (planned, M4+)

Assistant and meeting lifecycles are modeled as explicit, testable state
machines (Rust enums with pure transition functions) — no boolean soup.

## 11. On-disk layout

Nothing is written into the project directory. Paths come from Tauri's path
resolver, which follows XDG on Linux:

| Path                            | Contents                         |
| ------------------------------- | -------------------------------- |
| `~/.local/share/dev.zaper.app/` | `zaper.db`, imported documents   |
| `~/.cache/dev.zaper.app/`       | temporary files (safe to delete) |
| `~/.local/state/dev.zaper.app/` | logs                             |
| OS keyring (`dev.zaper.app`)    | API keys, one entry per provider |

---

## Roadmap

| Milestone | Scope                                                                       | Depends on | Status |
| --------- | --------------------------------------------------------------------------- | ---------- | ------ |
| **M0**    | Scaffold: Tauri + React + strict TS + Tailwind, typed IPC, app boots        | —          | done   |
| **M1**    | SQLite (sqlx) + settings + profiles + keyring + error taxonomy              | M0         | done   |
| M2        | Provider abstraction, streaming LLM, context engine, prompts, answer length | M1         | next   |
| M3        | PipeWire + cpal audio capture, streaming STT, transcript events             | M1         |        |
| M4        | Question detection + assistant state machine + conversation memory          | M2, M3     |        |
| M5        | Floating assistant window, streaming answers, global shortcuts              | M4         |        |
| M6        | TTS (sentence-buffered) + earpiece mode                                     | M5         |        |
| M7        | Document import + chunking + retrieval (RAG)                                | M2         |        |
| M8        | Screen reading + vision + coding screen analysis                            | M2, M5     |        |
| M9        | Meeting mode: capture, live transcript, summary + action items              | M3, M2     |        |
| M10       | Meeting search + Q&A with source timestamps                                 | M9         |        |
| M11       | Harden: retry/backoff, metrics, onboarding, packaging                       | all        |        |

Each milestone must pass: `cargo test` + `cargo clippy -- -D warnings` +
`cargo fmt --check` + `tsc --noEmit` + `eslint` + `prettier --check` +
`vitest run` + a working `pnpm tauri dev`.
