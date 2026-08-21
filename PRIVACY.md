# Privacy

**Zaper** is a private, local-first desktop application. Privacy is a
first-class requirement.

## Defaults

- **Local-first storage** — profiles, documents, settings, conversations and
  meetings are stored in a local SQLite database under your user data
  directory (`~/.local/share/dev.zaper.app/zaper.db`). Nothing is written into
  the application's install location.
- **Offline by default** — a fresh install uses a built-in mock provider, so no
  data leaves the machine until you deliberately configure a cloud provider.
- **No analytics, telemetry, or advertising** — no background uploads, no
  third-party tracking, no automatic cloud synchronization.
- **Audio** is not permanently stored unless you explicitly enable
  recording/storage.
- **Screenshots** are not permanently stored unless you explicitly save them;
  temporary image data is deleted after processing.
- **Documents** remain on your machine.

## What is stored locally

| Data                                               | Where                              |
| -------------------------------------------------- | ---------------------------------- |
| Profiles, experiences, projects, interview stories | SQLite                             |
| Settings and preferences                           | SQLite (one JSON document)         |
| Interviews, conversations, meetings, transcripts   | SQLite                             |
| Imported documents and their text chunks           | user data directory + SQLite       |
| API keys                                           | OS keyring only                    |
| Last chosen theme                                  | `localStorage` (first-paint cache) |

Deleting a profile also deletes its experiences, projects and stories, and clears
it from your settings — no orphaned rows are left behind.

## What is sent to cloud AI

Zaper uses cloud AI providers only for operations you initiate (transcription,
answer generation, screen analysis, speech synthesis, meeting summaries).
Only the **minimum necessary context** is sent:

- **STT**: the audio you are currently transcribing.
- **LLM**: your question, the active profile/interview context you've chosen,
  recent relevant conversation, and retrieved document chunks (not whole
  documents).
- **Vision**: the screenshot you asked to analyze.
- **TTS**: the text of the answer being spoken.

Settings includes a **"What is sent to cloud AI"** panel that is generated from
your actual provider configuration rather than from fixed copy, so it cannot
drift from what the app really does. If every capability is on the mock provider,
it says so: nothing leaves the machine. You control the provider, model and
endpoint; requests go directly from your machine to that provider.

## API keys

AI API keys are stored in the OS credential store (Secret Service — GNOME Keyring
or KWallet) under the service name `dev.zaper.app`. They are never written to
SQLite, config files or logs, and are never bundled into the frontend.

Keys are **write-only** from the interface's perspective: no IPC command returns a
stored key, so a key cannot be displayed, copied or leaked through the UI. Only
Rust-side provider adapters read the plaintext, and only to sign an outbound
request. If no keyring is available, the operation fails with an explanation —
Zaper never silently downgrades to plaintext storage.

## Logging

Diagnostic logs (opt-in, off by default) record lifecycle events, errors,
provider failures and performance metrics — **not** raw audio, full
transcripts, CV contents, API keys, sensitive documents, or complete prompts.

## Your control

- Delete meetings, documents, conversations and profiles at any time.
- Regenerate or discard AI answers.
- Choose which provider handles each kind of request.
- Opt into diagnostic logging only when troubleshooting.
