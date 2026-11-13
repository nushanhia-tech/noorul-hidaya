"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "./actions";

export type BoardTask = { id: string; title: string; status: string; priority: string; due_on: string | null; assignee: string | null };
const COLUMNS = ["todo", "in_progress", "waiting", "completed"];

/** Kanban board. Cards move with an accessible status select (works with keyboard and touch). */
export function TaskBoard({ tasks, today }: { tasks: BoardTask[]; today: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col);
        return (
          <section key={col} className="w-[80vw] shrink-0 snap-start rounded-md border border-line bg-sand/40 sm:w-[340px] lg:w-auto" aria-label={TASK_STATUS_LABELS[col]}>
            <h2 className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">{TASK_STATUS_LABELS[col]}<span className="tabular rounded-xs bg-paper px-1.5 text-xs text-muted">{items.length}</span></h2>
            <ul className="space-y-2 px-2 pb-2">
              {items.map((t) => (
                <li key={t.id} className={cn("rounded-sm border border-line bg-paper p-3 shadow-card", pending && "opacity-70")}>
                  <Link href={`/portal/office/tasks/${t.id}`} className="block text-sm font-medium leading-snug hover:underline">{t.title}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {t.priority !== "normal" && <StatusBadge status={t.priority} />}
                    {t.due_on && <span className={cn("inline-flex items-center gap-1", t.due_on < today && col !== "completed" && "font-medium text-danger")}><CalendarClock className="h-3 w-3" />{formatDate(t.due_on, { day: "numeric", month: "short" })}</span>}
                    {t.assignee && <span className="truncate">{t.assignee}</span>}
                  </div>
                  <select aria-label={`Move "${t.title}"`} value={t.status} disabled={pending}
                    onChange={(e) => start(async () => { await setTaskStatus(t.id, e.target.value); })}
                    className="mt-2.5 h-8 w-full rounded-xs border border-line bg-white px-2 text-xs">
                    {["todo", "in_progress", "waiting", "completed", "cancelled"].map((s) => <option key={s} value={s}>Move to: {TASK_STATUS_LABELS[s]}</option>)}
                  </select>
                </li>
              ))}
              {!items.length && <li className="px-2 py-6 text-center text-xs text-faint">No tasks</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
