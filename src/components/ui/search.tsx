import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** GET search/filter bar — works without JavaScript and keeps URLs shareable. */
export function FilterBar({
  q, placeholder = "Search…", children, className, hidden,
}: { q?: string; placeholder?: string; children?: React.ReactNode; className?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form method="get" role="search" className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <div className="relative min-w-0 flex-1 sm:min-w-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder}
          className="h-10 w-full rounded-sm border border-line-strong bg-white pl-9 pr-3 text-[15px] placeholder:text-faint focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/15 sm:text-sm"
        />
      </div>
      {children}
      <button type="submit" className="h-10 rounded-sm bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft">Apply</button>
    </form>
  );
}

export function FilterSelect({ name, value, options, label }: { name: string; value?: string; options: { value: string; label: string }[]; label: string }) {
  return (
    <select
      name={name} defaultValue={value ?? ""} aria-label={label}
      className="h-10 rounded-sm border border-line-strong bg-white px-3 pr-8 text-[15px] text-ink focus:border-royal focus:outline-none sm:text-sm"
    >
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
