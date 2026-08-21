import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { TagsField, TextAreaField, TextField } from "../../components/ui/Field";
import { IpcError, toIpcError } from "../../lib/errors";
import { getProfile } from "../../services/profiles";
import { useProfilesStore } from "../../stores/profiles";
import type { Profile } from "../../types/ipc";
import {
  emptyExperience,
  emptyProfileForm,
  emptyProject,
  emptyStory,
  profileToForm,
  toProfileInput,
  type ProfileFormState,
} from "./profileForm";

interface ProfileEditorProps {
  /** `null` means "create a new profile". */
  profileId: string | null;
  onSaved: (profile: Profile) => void;
  onCancel: () => void;
}

/**
 * The four STAR fields, kept discrete so prompts can turn a story into natural
 * speech instead of reciting "Situation: …" labels.
 */
const STAR_PARTS = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
] as const;

/**
 * Create/edit form for a profile and its children.
 *
 * The full profile is fetched on open (the list only carries summaries), so the
 * editor owns its own load state rather than depending on the store's list.
 */
export function ProfileEditor({ profileId, onSaved, onCancel }: ProfileEditorProps) {
  const [form, setForm] = useState<ProfileFormState>(emptyProfileForm);
  const [loading, setLoading] = useState(profileId !== null);
  const [loadError, setLoadError] = useState<IpcError | null>(null);
  const [saveError, setSaveError] = useState<IpcError | null>(null);

  const createProfile = useProfilesStore((state) => state.create);
  const updateProfile = useProfilesStore((state) => state.update);
  const mutating = useProfilesStore((state) => state.mutating);

  useEffect(() => {
    if (!profileId) {
      setForm(emptyProfileForm());
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getProfile(profileId)
      .then((profile) => {
        if (!cancelled) setForm(profileToForm(profile));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(toIpcError(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const update = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaveError(null);
    const input = toProfileInput(form);

    try {
      const saved = profileId ? await updateProfile(profileId, input) : await createProfile(input);

      onSaved(saved);
    } catch (cause) {
      // Validation messages come from Rust and are written for humans, so they
      // are shown as-is next to the form.
      setSaveError(toIpcError(cause));
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading profile…</p>;
  }

  if (loadError) {
    return <ErrorNotice error={loadError} onDismiss={onCancel} />;
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-5"
      // `required` stays on the fields for assistive technology, but native
      // constraint validation is disabled: Rust is the single validation
      // authority, and its human-readable messages are rendered in one
      // consistent place instead of a browser tooltip for some fields and an
      // error banner for others.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <ErrorNotice error={saveError} onDismiss={() => setSaveError(null)} />

      <Section title="Identity" detail="How the assistant introduces you.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Name"
            required
            value={form.name}
            disabled={mutating}
            placeholder="Ada Lovelace"
            onChange={(event) => update("name", event.target.value)}
          />
          <TextField
            label="Headline"
            value={form.headline}
            disabled={mutating}
            placeholder="Senior AI Engineer"
            onChange={(event) => update("headline", event.target.value)}
          />
        </div>

        <TextAreaField
          label="Summary"
          hint="A short professional summary. Used to ground answers — keep it factual."
          value={form.summary}
          disabled={mutating}
          onChange={(event) => update("summary", event.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TagsField
            label="Skills"
            value={form.skills}
            disabled={mutating}
            placeholder="Rust, TypeScript, systems design"
            onChange={(value) => update("skills", value)}
          />
          <TagsField
            label="Technologies"
            value={form.technologies}
            disabled={mutating}
            placeholder="Tauri, SQLite, PipeWire"
            onChange={(value) => update("technologies", value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextAreaField
            label="Achievements"
            hint="One per line."
            value={form.achievements}
            disabled={mutating}
            onChange={(event) => update("achievements", event.target.value)}
          />
          <TextAreaField
            label="Opinions"
            hint="One per line. Positions you actually hold, so answers sound like you."
            value={form.opinions}
            disabled={mutating}
            onChange={(event) => update("opinions", event.target.value)}
          />
        </div>
      </Section>

      <Section
        title="Experience"
        detail="Real roles only. The assistant is instructed never to invent employers."
        action={
          <Button
            variant="secondary"
            disabled={mutating}
            onClick={() => update("experiences", [...form.experiences, emptyExperience()])}
          >
            Add role
          </Button>
        }
      >
        {form.experiences.length === 0 ? (
          <EmptyChildHint text="No roles yet." />
        ) : (
          form.experiences.map((experience, index) => (
            <ChildCard
              key={experience.key}
              title={experience.role || experience.company || "New role"}
              disabled={mutating}
              onRemove={() =>
                update(
                  "experiences",
                  form.experiences.filter((_, position) => position !== index),
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Company"
                  value={experience.company}
                  disabled={mutating}
                  onChange={(event) =>
                    update(
                      "experiences",
                      form.experiences.map((row, position) =>
                        position === index ? { ...row, company: event.target.value } : row,
                      ),
                    )
                  }
                />
                <TextField
                  label="Role"
                  value={experience.role}
                  disabled={mutating}
                  onChange={(event) =>
                    update(
                      "experiences",
                      form.experiences.map((row, position) =>
                        position === index ? { ...row, role: event.target.value } : row,
                      ),
                    )
                  }
                />
                <TextField
                  label="Start"
                  hint="Any format — 2022, March 2022."
                  value={experience.startDate}
                  disabled={mutating}
                  onChange={(event) =>
                    update(
                      "experiences",
                      form.experiences.map((row, position) =>
                        position === index ? { ...row, startDate: event.target.value } : row,
                      ),
                    )
                  }
                />
                <TextField
                  label="End"
                  hint="Leave empty for current."
                  value={experience.endDate}
                  disabled={mutating}
                  onChange={(event) =>
                    update(
                      "experiences",
                      form.experiences.map((row, position) =>
                        position === index ? { ...row, endDate: event.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
              <TextAreaField
                label="What you did"
                value={experience.description}
                disabled={mutating}
                onChange={(event) =>
                  update(
                    "experiences",
                    form.experiences.map((row, position) =>
                      position === index ? { ...row, description: event.target.value } : row,
                    ),
                  )
                }
              />
            </ChildCard>
          ))
        )}
      </Section>

      <Section
        title="Projects"
        detail="Concrete work you can talk about in detail."
        action={
          <Button
            variant="secondary"
            disabled={mutating}
            onClick={() => update("projects", [...form.projects, emptyProject()])}
          >
            Add project
          </Button>
        }
      >
        {form.projects.length === 0 ? (
          <EmptyChildHint text="No projects yet." />
        ) : (
          form.projects.map((project, index) => (
            <ChildCard
              key={project.key}
              title={project.name || "New project"}
              disabled={mutating}
              onRemove={() =>
                update(
                  "projects",
                  form.projects.filter((_, position) => position !== index),
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Name"
                  value={project.name}
                  disabled={mutating}
                  onChange={(event) =>
                    update(
                      "projects",
                      form.projects.map((row, position) =>
                        position === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                />
                <TextField
                  label="Link"
                  value={project.url}
                  disabled={mutating}
                  placeholder="https://…"
                  onChange={(event) =>
                    update(
                      "projects",
                      form.projects.map((row, position) =>
                        position === index ? { ...row, url: event.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
              <TagsField
                label="Technologies"
                value={project.technologies}
                disabled={mutating}
                onChange={(value) =>
                  update(
                    "projects",
                    form.projects.map((row, position) =>
                      position === index ? { ...row, technologies: value } : row,
                    ),
                  )
                }
              />
              <TextAreaField
                label="Description"
                value={project.description}
                disabled={mutating}
                onChange={(event) =>
                  update(
                    "projects",
                    form.projects.map((row, position) =>
                      position === index ? { ...row, description: event.target.value } : row,
                    ),
                  )
                }
              />
            </ChildCard>
          ))
        )}
      </Section>

      <Section
        title="Interview stories"
        detail="Situation, task, action and result — stored separately so answers can weave them into natural speech instead of reciting labels."
        action={
          <Button
            variant="secondary"
            disabled={mutating}
            onClick={() => update("stories", [...form.stories, emptyStory()])}
          >
            Add story
          </Button>
        }
      >
        {form.stories.length === 0 ? (
          <EmptyChildHint text="No stories yet." />
        ) : (
          form.stories.map((story, index) => (
            <ChildCard
              key={story.key}
              title={story.title || "New story"}
              disabled={mutating}
              onRemove={() =>
                update(
                  "stories",
                  form.stories.filter((_, position) => position !== index),
                )
              }
            >
              <TextField
                label="Title"
                value={story.title}
                disabled={mutating}
                placeholder="Cut answer latency in half"
                onChange={(event) =>
                  update(
                    "stories",
                    form.stories.map((row, position) =>
                      position === index ? { ...row, title: event.target.value } : row,
                    ),
                  )
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {STAR_PARTS.map(({ key, label }) => (
                  <TextAreaField
                    key={key}
                    label={label}
                    rows={2}
                    value={story[key]}
                    disabled={mutating}
                    onChange={(event) =>
                      update(
                        "stories",
                        form.stories.map((row, position) =>
                          position === index ? { ...row, [key]: event.target.value } : row,
                        ),
                      )
                    }
                  />
                ))}
              </div>
              <TagsField
                label="Tags"
                hint="Used later to pick the most relevant story for a question."
                value={story.tags}
                disabled={mutating}
                onChange={(value) =>
                  update(
                    "stories",
                    form.stories.map((row, position) =>
                      position === index ? { ...row, tags: value } : row,
                    ),
                  )
                }
              />
            </ChildCard>
          ))
        )}
      </Section>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50/90 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Button variant="ghost" onClick={onCancel} disabled={mutating}>
          Cancel
        </Button>
        <button
          type="submit"
          disabled={mutating}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutating ? "Saving…" : profileId ? "Save changes" : "Create profile"}
        </button>
      </div>
    </form>
  );
}

interface SectionProps {
  title: string;
  detail?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, detail, action, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {detail ? (
            <p className="mt-0.5 max-w-prose text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ChildCard({
  title,
  disabled,
  onRemove,
  children,
}: {
  title: string;
  disabled?: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</p>
        <Button
          variant="ghost"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${title}`}
        >
          Remove
        </Button>
      </div>
      {children}
    </div>
  );
}

function EmptyChildHint({ text }: { text: string }) {
  return <p className="text-xs text-zinc-500 dark:text-zinc-400">{text}</p>;
}
