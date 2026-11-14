import Link from "next/link";
import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import { Logo } from "./brand";
import { MAIN_NAV, UTILITY_NAV } from "./nav";
import { MobileNav } from "./mobile-nav";
import type { SiteSettings } from "@/lib/data/site";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      {/* Desktop: two-tier institutional header */}
      <div className="mx-auto hidden max-w-[1440px] lg:flex">
        <Link href="/" className="flex w-[260px] shrink-0 items-center border-r border-line px-8" aria-label={`${settings.college_name} — home`}>
          <Logo name={settings.college_name} logoPath={settings.logo_path} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex h-[52px] items-stretch border-b border-line">
            <nav aria-label="Utility links" className="flex items-center gap-7 border-r border-line px-8 text-sm text-ink-soft">
              {UTILITY_NAV.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-ink">{l.label}</Link>
              ))}
            </nav>
            <form action="/search" role="search" className="flex flex-1 items-center gap-2.5 px-8">
              <Search className="h-4 w-4 text-royal" aria-hidden />
              <input name="q" type="search" placeholder="Search classes, departments, news…" aria-label="Search the website"
                className="h-full w-full bg-transparent text-sm placeholder:text-faint focus:outline-none" />
            </form>
            <Link href="/login" className="flex items-center gap-2 bg-royal px-8 text-sm font-medium text-white transition-colors hover:bg-royal-600">
              Portal Login <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <nav aria-label="Main" className="flex h-[60px] items-center gap-1 px-6">
            {MAIN_NAV.map((item) =>
              item.children ? (
                <div key={item.label} className="group relative">
                  <Link href={item.href} className="flex items-center gap-1 rounded-sm px-3 py-2 text-[14.5px] text-ink-soft transition-colors hover:text-ink group-focus-within:text-ink" aria-haspopup="true">
                    {item.label} <ChevronDown className="h-3.5 w-3.5 text-faint transition-transform group-hover:rotate-180" />
                  </Link>
                  <div className="invisible absolute left-0 top-full z-50 w-[300px] pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <ul className="rounded-md border border-line bg-paper p-2 shadow-pop">
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link href={c.href} className="block rounded-sm px-3 py-2.5 hover:bg-ivory focus:bg-ivory">
                            <span className="block text-sm font-medium text-ink">{c.label}</span>
                            {c.description && <span className="block text-[12.5px] text-muted">{c.description}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <Link key={item.label} href={item.href} className="rounded-sm px-3 py-2 text-[14.5px] text-ink-soft transition-colors hover:text-ink">
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>
      {/* Mobile / tablet */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:hidden">
        <Link href="/" aria-label={`${settings.college_name} — home`}>
          <Logo name={settings.college_name} logoPath={settings.logo_path} compact />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden h-9 items-center gap-1.5 rounded-sm bg-royal px-3.5 text-[13px] font-medium text-white sm:inline-flex">
            Portal Login <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <MobileNav collegeName={settings.college_name} />
        </div>
      </div>
    </header>
  );
}
