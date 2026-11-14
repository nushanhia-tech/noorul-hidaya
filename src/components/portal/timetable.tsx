import { DAY_NAMES, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { CalendarX } from "lucide-react";

export type TimetableEntry = { id: string; day: number; start: string; end: string; room: string; title: string; code: string; sub?: string };

/** Week grid on desktop; per-day agenda lists on mobile. */
export function WeekTimetable({ entries, today }: { entries: TimetableEntry[]; today: number }) {
  if (!entries.length) return <EmptyState icon={CalendarX} title="No periods scheduled" description="The timetable for the current term has not been published yet." />;
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || entries.some((e) => e.day === d));
  return (
    <>
      <div className="hidden gap-3 lg:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => (
          <div key={d} className={cn("rounded-md border bg-paper", d === today ? "border-accent/40" : "border-line")}>
            <p className={cn("border-b px-3 py-2.5 text-sm font-semibold", d === today ? "border-accent/30 text-accent-700" : "border-line")}>
              {DAY_NAMES[d]} {d === today && <span className="ml-1 text-xs font-normal">· today</span>}
            </p>
            <ul className="space-y-2 p-2.5">
              {entries.filter((e) => e.day === d).map((e) => (
                <li key={e.id} className="rounded-sm border border-line bg-white p-2.5">
                  <p className="tabular text-[11.5px] text-muted">{formatTime(e.start)} – {formatTime(e.end)}</p>
                  <p className="mt-1 text-[13px] font-medium leading-snug">{e.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-faint">{e.code}{e.room && ` · ${e.room}`}</p>
                  {e.sub && <p className="mt-0.5 truncate text-[11.5px] text-faint">{e.sub}</p>}
                </li>
              ))}
              {!entries.some((e) => e.day === d) && <li className="px-1 py-3 text-center text-xs text-faint">No periods</li>}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-5 lg:hidden">
        {[...days.filter((d) => d >= today), ...days.filter((d) => d < today)].map((d) => (
          <section key={d}>
            <h2 className={cn("mb-2 text-sm font-semibold", d === today && "text-accent-700")}>{DAY_NAMES[d]}{d === today && " · Today"}</h2>
            <DayAgenda entries={entries.filter((e) => e.day === d)} />
          </section>
        ))}
      </div>
    </>
  );
}

export function DayAgenda({ entries }: { entries: TimetableEntry[] }) {
  if (!entries.length) return <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-muted">No periods</p>;
  return (
    <ol className="divide-y divide-line rounded-md border border-line bg-paper">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-4 px-4 py-3">
          <div className="tabular w-[72px] shrink-0 text-[13px] text-ink-soft">
            <p className="font-medium">{formatTime(e.start)}</p>
            <p className="text-faint">{formatTime(e.end)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{e.title}</p>
            <p className="text-[12.5px] text-muted">{e.code}{e.room && ` · ${e.room}`}{e.sub && ` · ${e.sub}`}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
