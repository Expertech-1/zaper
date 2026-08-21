# Contributing

Thanks for contributing to **Zaper** — a private, Linux-first desktop AI copilot.

## Workflow

1. Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) — especially the **Roadmap**.
   Work in small milestones; never land half a milestone as if it were done.
2. Pick a milestone (or a task within it). If it isn't tracked yet, open a
   thread/discussion describing the plan first.
3. Implement, then run the **full verification gate** (below).
4. Keep the docs (`README`, `ARCHITECTURE`) in sync with the code.

## Verification gate

Before every merge/commit:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check        # run `pnpm format` to fix, then re-check
pnpm test
pnpm build

cd src-tauri
cargo fmt --check        # run `cargo fmt` to fix
cargo clippy -- -D warnings
cargo test
cd ..
```

Optionally smoke-test the app: `pnpm tauri dev`.

> Do not proceed while the project is knowingly broken unless the issue is
> explicitly documented and isolated.

## Conventions

- **TypeScript**: strict mode; no `any`; no `.js` files for application logic.
- **Rust**: idiomatic, `rustfmt`-formatted, `clippy`-clean; prefer typed errors
  (`thiserror`) over stringly errors.
- **IPC**: every command/event must be declared in `src/types/ipc.ts` **and**
  mirrored in `src-tauri/src/commands/`. Frontend code calls typed wrappers in
  `src/services/`, never raw `invoke()` strings.
- **AI**: never call a provider directly from a UI component. Use the provider
  abstraction. Validate AI output with Zod/Rust schemas. Prompts live in a
  centralized, versioned module.
- **State**: model lifecycles as explicit state machines, not boolean flags.
- **Async**: never block the UI thread; all long-running ops support
  cancellation and have loading/error/success states.

## Testing strategy

- **Unit**: question classification, context selection, prompt construction,
  answer-length rules, state transitions, settings validation, repositories.
- **Integration**: provider adapters (with mock providers), SQLite
  repositories, IPC contracts, streaming events.
- **UI**: profiles, interviews, mode switching, assistant window, settings,
  document import (React Testing Library).
- **Rust**: state machines, audio lifecycle logic, command validation, fs ops.
- **E2E**: Playwright where practical.
