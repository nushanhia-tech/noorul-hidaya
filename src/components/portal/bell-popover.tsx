"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/app/portal/notifications-actions";

type Item = { id: string; title: string; body: string; type: string; link: string | null; read_at: string | null; created_at: string };

export function BellPopover({ unread, items, allHref }: { unread: number; items: Item[]; allHref: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-white text-ink-soft hover:text-ink"
        data-testid="notification-bell"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="tabular absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10.5px] font-semibold leading-[18px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-md border border-line bg-paper shadow-pop animate-rise sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <form action={markAllNotificationsRead}>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-royal hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
              </form>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">You&rsquo;re all caught up.</p>
          ) : (
            <ul className="max-h-[60dvh] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <a href={`/portal/notifications/${n.id}`} className={cn("flex gap-3 px-4 py-3 hover:bg-white", !n.read_at && "bg-accent-50/40")}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug text-ink">{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-faint">{relativeTime(n.created_at)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link href={allHref} className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-ink hover:bg-white">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
