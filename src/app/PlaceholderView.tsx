import type { SectionId } from "../components/layout/Sidebar";

interface PlaceholderViewProps {
  section: SectionId;
}

export function PlaceholderView({ section }: PlaceholderViewProps) {
  const title = section.charAt(0).toUpperCase() + section.slice(1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white/50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {title} arrives in a later milestone
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          The M0 scaffold is intentionally minimal — this section is wired into the navigation and
          will be built out as its milestone lands.
        </p>
      </div>
    </div>
  );
}
