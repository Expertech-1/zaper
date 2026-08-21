# Privacy

**Zaper** is a private, local-first desktop application. Privacy is a
first-class requirement.

## Defaults

- **Local-first storage** — profiles, documents, settings, conversations and
  meetings are stored in a local SQLite database under your user data
  directory.
- **No analytics, telemetry, or advertising** — no background uploads, no
  third-party tracking, no automatic cloud synchronization.
- **Audio** is not permanently stored unless you explicitly enable
  recording/storage.
- **Screenshots** are not permanently stored unless you explicitly save them;
  temporary image data is deleted after processing.
- **Documents** remain on your machine.

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

The Settings app includes a **"What is sent to cloud AI"** explanation that
reflects this policy. You control the provider, model and endpoint; requests
go directly from your machine to that provider.

## API keys

AI API keys are stored in the OS credential store (Secret Service) and are
never written to SQLite or plaintext config, and never included in logs.

## Logging

Diagnostic logs (opt-in, off by default) record lifecycle events, errors,
provider failures and performance metrics — **not** raw audio, full
transcripts, CV contents, API keys, sensitive documents, or complete prompts.

## Your control

- Delete meetings, documents, conversations and profiles at any time.
- Regenerate or discard AI answers.
- Choose which provider handles each kind of request.
- Opt into diagnostic logging only when troubleshooting.
