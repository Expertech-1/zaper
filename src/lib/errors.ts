import { ipcErrorSchema, type ErrorKind, type IpcErrorPayload } from "../types/ipc";

/**
 * A failure that crossed the IPC boundary, carrying the machine-readable kind
 * the Rust core assigned to it.
 *
 * Components should branch on `kind` / `retryable` rather than matching on
 * message text, so copy changes never break behaviour.
 */
export class IpcError extends Error {
  readonly kind: ErrorKind;
  readonly retryable: boolean;

  constructor(payload: IpcErrorPayload) {
    super(payload.message);
    this.name = "IpcError";
    this.kind = payload.kind;
    this.retryable = payload.retryable;
  }
}

/**
 * Normalizes anything thrown by `invoke` into an `IpcError`.
 *
 * Rust commands reject with a structured `IpcError`, but a transport-level
 * failure (missing command, serialization problem, webview teardown) surfaces as
 * a string or an `Error`. Both are mapped so callers only ever handle one type.
 */
export function toIpcError(cause: unknown): IpcError {
  const parsed = ipcErrorSchema.safeParse(cause);
  if (parsed.success) {
    return new IpcError(parsed.data);
  }

  if (cause instanceof IpcError) {
    return cause;
  }

  const message = cause instanceof Error ? cause.message : String(cause);

  return new IpcError({
    kind: "internal",
    message: message || "Something went wrong inside Zaper.",
    retryable: false,
  });
}

/** Whether a validation error should be shown inline on a form field. */
export function isValidationError(error: unknown): boolean {
  return error instanceof IpcError && error.kind === "validation";
}
