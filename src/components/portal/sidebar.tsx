"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS } from "./icons";
import type { NavGroup, NavLink } from "./nav-config";

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ groups, root }: { groups: NavGroup[]; root: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.links.map((l) => {
              const Icon = ICONS[l.icon];
              const active = isActive(pathname, l.href, root);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-sm px-3 py-2 text-[14px] transition-colors",
                      active ? "bg-white font-medium text-ink shadow-card" : "text-ink-soft hover:bg-white/60 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-faint")} />
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Mobile bottom navigation with a "More" sheet containing the full menu. */
export function BottomNav({ groups, root, footer }: { groups: NavGroup[]; root: string; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  const all = groups.flatMap((g) => g.links);
  const primary: NavLink[] = all.filter((l) => l.mobile).slice(0, 4);
  return (
    <>
      <nav aria-label="Portal shortcuts" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((l) => {
            const Icon = ICONS[l.icon];
            const active = isActive(pathname, l.href, root);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", active ? "font-medium text-ink" : "text-muted")}>
                  <Icon className={cn("h-5 w-5", active && "text-accent")} />
                  <span className="max-w-full truncate px-1">{l.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] text-muted" aria-expanded={open} aria-controls="portal-more">
              <MoreHorizontal className="h-5 w-5" /> More
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Portal menu" id="portal-more">
          <button className="absolute inset-0 bg-ink/30 animate-fade-in" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg bg-ivory p-4 animate-rise">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Menu</p>
              <button onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-white" aria-label="Close menu"><X className="h-4 w-4" /></button>
            </div>
            <SidebarNav groups={groups} root={root} />
            {footer && <div className="mt-6 border-t border-line pt-4">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}
