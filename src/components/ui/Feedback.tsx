import type { ReactNode } from "react";
import { IpcError } from "../../lib/errors";
import { Button } from "./Button";

/**
 * Error banner that adapts to the error's category.
 *
 * A retryable failure (network, provider, database) gets a Retry action; a
 * validation mistake does not, because retrying the same input changes nothing.
 */
interface ErrorNoticeProps {
  error: IpcError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const KIND_LABELS: Record<IpcError["kind"], string> = {
  validation: "Check your input",
  notFound: "No longer available",
  database: "Local storage problem",
  credential: "Keyring problem",
  io: "File problem",
  network: "No connection",
  provider: "AI provider problem",
  unsupported: "Not supported here",
  cancelled: "Cancelled",
  internal: "Unexpected problem",
};

export function ErrorNotice({ error, onRetry, onDismiss }: ErrorNoticeProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm dark:border-red-900 dark:bg-red-950/60"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-red-800 dark:text-red-200">{KIND_LABELS[error.kind]}</p>
        <p className="mt-0.5 text-red-700 dark:text-red-300">{error.message}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {error.retryable && onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {onDismiss ? (
          <Button variant="ghost" onClick={onDismiss} aria-label="Dismiss error">
            ✕
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Neutral placeholder for a list or panel with nothing in it yet. */
interface EmptyStateProps {
  title: string;
  detail: string;
  action?: ReactNode;
}

export function EmptyState({ title, detail, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-300 bg-white/50 px-5 py-6 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
      </div>
      {action}
    </div>
  );
}

/** Inline loading indicator sized for panels and lists. */
export function LoadingRow({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 px-1 py-3 text-sm text-zinc-500 dark:text-zinc-400">
      <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" aria-hidden />
      {label}
    </p>
  );
}
