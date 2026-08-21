export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "interview", label: "Interview" },
  { id: "profiles", label: "Profiles" },
  { id: "documents", label: "Documents" },
  { id: "meetings", label: "Meetings" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
] as const;

export type SectionId = (typeof NAV_ITEMS)[number]["id"];

interface SidebarProps {
  active: SectionId;
  onSelect: (section: SectionId) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-2 px-2 pb-4 pt-1">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
          Z
        </div>
        <span className="text-sm font-semibold tracking-wide">Zaper</span>
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                isActive
                  ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isActive ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-zinc-200 px-2 pt-3 text-[11px] leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Private · local-first
      </div>
    </nav>
  );
}
