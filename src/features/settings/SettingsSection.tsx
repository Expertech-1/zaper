import type { ReactNode } from "react";

/** Shared card layout for a settings group. */
export function SettingsSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header>
        <h2 className="text-sm font-semibold">{title}</h2>
        {detail ? (
          <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {detail}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
