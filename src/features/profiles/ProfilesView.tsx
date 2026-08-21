import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNotice, LoadingRow } from "../../components/ui/Feedback";
import { useProfilesStore } from "../../stores/profiles";
import type { ProfileSummary } from "../../types/ipc";
import { ProfileEditor } from "./ProfileEditor";

/** `null` = list view; `{ id: null }` = create; `{ id }` = edit. */
type Selection = { id: string | null } | null;

/**
 * Profiles section: a list of profiles with the active one marked, plus the
 * create/edit form.
 *
 * Profiles answer "who is the candidate?". Interview-specific context lives in
 * the Interview section and is never written back here (spec §8).
 */
export function ProfilesView() {
  const summaries = useProfilesStore((state) => state.summaries);
  const status = useProfilesStore((state) => state.status);
  const error = useProfilesStore((state) => state.error);
  const mutating = useProfilesStore((state) => state.mutating);
  const load = useProfilesStore((state) => state.load);
  const clearError = useProfilesStore((state) => state.clearError);

  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    void load();
  }, [load]);

  if (selection) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {selection.id ? "Edit profile" : "New profile"}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Only real experience. The assistant is instructed to say it lacks information rather
              than invent any.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setSelection(null)}>
            Back to list
          </Button>
        </header>

        <ProfileEditor
          profileId={selection.id}
          onSaved={() => setSelection(null)}
          onCancel={() => setSelection(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Profiles</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Who the assistant answers as. One profile is active at a time.
          </p>
        </div>
        <Button variant="primary" onClick={() => setSelection({ id: null })} disabled={mutating}>
          New profile
        </Button>
      </header>

      <ErrorNotice error={error} onRetry={() => void load()} onDismiss={clearError} />

      {status === "loading" && summaries.length === 0 ? (
        <LoadingRow label="Loading profiles…" />
      ) : null}

      {status === "ready" && summaries.length === 0 ? (
        <EmptyState
          title="No profiles yet"
          detail="Create a profile with your real experience, skills and interview stories. Everything stays on this machine."
          action={
            <Button variant="primary" onClick={() => setSelection({ id: null })}>
              Create your first profile
            </Button>
          }
        />
      ) : null}

      {summaries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {summaries.map((summary) => (
            <ProfileRow
              key={summary.id}
              summary={summary}
              onEdit={() => setSelection({ id: summary.id })}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProfileRow({ summary, onEdit }: { summary: ProfileSummary; onEdit: () => void }) {
  const activate = useProfilesStore((state) => state.activate);
  const duplicate = useProfilesStore((state) => state.duplicate);
  const remove = useProfilesStore((state) => state.remove);
  const mutating = useProfilesStore((state) => state.mutating);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{summary.name}</p>
          {summary.isActive ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              active
            </span>
          ) : null}
        </div>

        {summary.headline ? (
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{summary.headline}</p>
        ) : null}

        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
          {countLabel(summary.skillCount, "skill")} · {countLabel(summary.experienceCount, "role")}{" "}
          · {countLabel(summary.projectCount, "project")} ·{" "}
          {countLabel(summary.storyCount, "story", "stories")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Delete?</span>
            <Button
              variant="secondary"
              disabled={mutating}
              onClick={() => {
                setConfirmingDelete(false);
                void remove(summary.id);
              }}
            >
              Yes, delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <>
            {!summary.isActive ? (
              <Button
                variant="secondary"
                disabled={mutating}
                onClick={() => void activate(summary.id)}
              >
                Set active
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onEdit} disabled={mutating}>
              Edit
            </Button>
            <Button variant="ghost" disabled={mutating} onClick={() => void duplicate(summary.id)}>
              Duplicate
            </Button>
            <Button variant="ghost" disabled={mutating} onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
