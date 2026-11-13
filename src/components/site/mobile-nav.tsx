"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X, Search } from "lucide-react";
import { MAIN_NAV } from "./nav";

export function MobileNav({ collegeName }: { collegeName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-white text-ink" aria-label="Open menu"
        data-testid="mobile-menu-button"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Site menu" className="fixed inset-0 z-50 flex flex-col bg-paper animate-fade-in">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6">
            <span className="font-display text-sm font-semibold">{collegeName}</span>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <form action="/search" role="search" className="mb-4 flex items-center gap-2 rounded-sm border border-line-strong bg-white px-3">
              <Search className="h-4 w-4 text-faint" aria-hidden />
              <input name="q" type="search" placeholder="Search the website" aria-label="Search the website" className="h-11 w-full bg-transparent text-[15px] focus:outline-none" />
            </form>
            <nav aria-label="Main">
              <ul className="divide-y divide-line">
                {MAIN_NAV.map((item) => (
                  <li key={item.label} className="py-1">
                    <Link href={item.href} className="flex items-center justify-between py-3 text-[17px] font-medium text-ink">
                      {item.label}
                    </Link>
                    {item.children && (
                      <ul className="mb-2 ml-3 border-l border-line pl-4">
                        {item.children.filter((c) => c.href !== item.href).map((c) => (
                          <li key={c.href}>
                            <Link href={c.href} className="block py-2 text-[15px] text-ink-soft">{c.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="safe-bottom shrink-0 border-t border-line p-4">
            <Link href="/login" className="flex h-12 items-center justify-center gap-2 rounded-sm bg-royal text-[15px] font-medium text-white">
              Portal Login <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
