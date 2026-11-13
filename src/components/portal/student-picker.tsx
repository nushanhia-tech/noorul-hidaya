"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { searchStudents } from "@/app/portal/office/lookup-actions";

/** Type-ahead student selector (server-side search, RLS-limited). */
export function StudentPicker({ name, defaultId, defaultLabel, required }: { name: string; defaultId?: string; defaultLabel?: string | null; required?: boolean }) {
  const [value, setValue] = useState<{ id: string; label: string } | null>(defaultId && defaultLabel ? { id: defaultId, label: defaultLabel } : null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => setResults(await searchStudents(q)), 250);
  }, [q]);
  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-sm border border-line-strong bg-white px-3 text-sm">
        <span className="truncate">{value.label}</span>
        <input type="hidden" name={name} value={value.id} />
        <button type="button" onClick={() => setValue(null)} aria-label="Clear student" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input type="hidden" name={name} value="" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or register number" required={required} aria-label="Search student"
        className="h-10 w-full rounded-sm border border-line-strong bg-white px-3 text-[15px] focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/15 sm:text-sm" />
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-line bg-paper shadow-pop" role="listbox">
          {results.map((r) => (
            <li key={r.id}><button type="button" role="option" aria-selected={false} onClick={() => { setValue(r); setQ(""); setResults([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-ivory">{r.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
