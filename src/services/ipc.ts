/**
 * Typed transport for the Tauri IPC layer.
 *
 * Every feature talks to Rust through `callCommand` (usually via the
 * feature-specific wrappers in this folder) — never through raw `invoke()` with
 * ad-hoc strings.
 *
 * Two guarantees this module provides:
 *
 *  1. **Results are validated.** Each command's result is parsed with its Zod
 *     schema from the registry, so contract drift fails loudly and locally
 *     instead of surfacing as `undefined` three components later.
 *  2. **Errors are typed.** Anything thrown becomes an `IpcError` carrying the
 *     Rust error kind, so callers can distinguish network from validation from
 *     cancellation without string matching.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../lib/env";
import { IpcError, toIpcError } from "../lib/errors";
import { commandRegistry, type CommandName } from "../types/ipc";
import type { z } from "zod";
import { callDevCommand, isDevCommand } from "./devBackend";

/** The validated result type of a command. */
export type CommandResult<K extends CommandName> = z.infer<(typeof commandRegistry)[K]>;

/** Arguments passed to a command. Keys must match the Rust parameter names. */
export type CommandArgs = Record<string, unknown>;

/**
 * Invokes a Rust command, validating its result and normalizing its errors.
 */
export async function callCommand<K extends CommandName>(
  command: K,
  args?: CommandArgs,
): Promise<CommandResult<K>> {
  const schema = commandRegistry[command];

  let raw: unknown;

  try {
    // Outside Tauri (`pnpm dev` in a plain browser, component tests) an
    // in-memory stand-in keeps the UI usable. See `devBackend.ts`.
    raw = isTauri()
      ? await invoke<unknown>(command, args)
      : await callDevCommandOrFail(command, args);
  } catch (cause) {
    throw toIpcError(cause);
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    // A contract mismatch is a bug in *our* code, not user error. Make it
    // obvious in the console while still failing gracefully in the UI.
    console.error(`IPC contract mismatch for "${command}"`, parsed.error.issues);

    throw new IpcError({
      kind: "internal",
      message: `Zaper received an unexpected response from its core (${command}).`,
      retryable: false,
    });
  }

  return parsed.data as CommandResult<K>;
}

async function callDevCommandOrFail(command: CommandName, args?: CommandArgs): Promise<unknown> {
  if (!isDevCommand(command)) {
    throw new IpcError({
      kind: "unsupported",
      message: `"${command}" needs the Zaper desktop app; it is not available in a browser preview.`,
      retryable: false,
    });
  }

  return callDevCommand(command, args);
}
