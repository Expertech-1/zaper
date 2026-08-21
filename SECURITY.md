# Security

**Zaper** is a local-first Ubuntu desktop application. This document describes
its security model.

## Principles

1. **Least privilege.** The Tauri capability/permission system is used
   deliberately. Permissions are granted feature-by-feature in
   `src-tauri/capabilities/`. The frontend is **not** given arbitrary
   filesystem or shell access.
2. **Narrow, typed commands.** Rust exposes intentional commands (e.g.
   `get_profile(id)`, `import_document(path)`), never generic ones (e.g.
   `execute_arbitrary_command`).
3. **Treat all external input as untrusted.** File paths, imported files, AI
   responses, provider JSON, database records, IPC payloads and configuration
   values are validated at the boundary (Zod on TypeScript, typed deserialization
   and explicit checks in Rust).
4. **Secrets stay in the OS keyring.** AI API keys are stored via the system
   Secret Service (keyring), never in SQLite, source code, or plaintext config.
   If the keyring is unavailable, a fallback with a clear warning may be used.
5. **No shell execution.** We never execute AI-generated shell commands or code
   automatically.
6. **No unsafe HTML rendering.** AI output is rendered as text; no untrusted
   HTML is injected.

## Threat model

Zaper is a single-user desktop app. The primary risks are: accidental leakage
of API keys, sending more data to cloud providers than necessary, and
processing untrusted input (imported documents, provider responses).

## Reporting a vulnerability

Contact the maintainers privately with a description, affected versions, and a
minimal repro. Do not open public issues for security bugs.
