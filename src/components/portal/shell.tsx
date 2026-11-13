import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, LogOut, Settings } from "lucide-react";
import { Emblem } from "@/components/site/brand";
import { Avatar } from "@/components/ui/misc";
import { getSiteSettings } from "@/lib/data/site";
import { hasPermission } from "@/lib/auth/permissions";
import { PORTAL_LABELS, ROLE_LABELS, portalPath, type Portal } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { PORTAL_NAV, PORTAL_ACCENT, type NavGroup } from "./nav-config";
import { SidebarNav, BottomNav } from "./sidebar";
import { NotificationBell } from "./notification-bell";

export function navFor(user: SessionUser, portal: Portal): NavGroup[] {
  return PORTAL_NAV[portal]
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.permission || hasPermission(user.permissions, l.permission)) }))
    .filter((g) => g.links.length);
}

export async function PortalShell({ user, portal, children }: { user: SessionUser; portal: Portal; children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const groups = navFor(user, portal);
  const root = portalPath(portal);
  const roleLabel = user.roles.filter((r) => (portal === "office" ? r.startsWith("office") || r === "accountant" : r === portal)).map((r) => ROLE_LABELS[r]).join(", ");

  const accountLinks = (
    <div className="space-y-1">
      <Link href="/portal/account" className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-soft hover:bg-white/60"><Settings className="h-4 w-4 text-faint" /> Account settings</Link>
      {user.portals.length > 1 && (
        <Link href="/select-role" className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-soft hover:bg-white/60"><ArrowLeftRight className="h-4 w-4 text-faint" /> Switch portal</Link>
      )}
      <form action="/auth/signout" method="post">
        <button className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-soft hover:bg-white/60"><LogOut className="h-4 w-4 text-faint" /> Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ivory lg:flex">
        <Link href={root} className="flex h-[72px] items-center gap-3 border-b border-line px-5">
          <Emblem className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-display text-[13.5px] font-semibold leading-tight">{settings.short_name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cn("h-1.5 w-1.5 rounded-full", PORTAL_ACCENT[portal])} /> {PORTAL_LABELS[portal]}
            </span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav groups={groups} root={root} />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center gap-3 px-3 py-2">
            <Avatar name={user.fullName} src={mediaUrl(user.avatarPath)} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-muted">{roleLabel || PORTAL_LABELS[portal]}</p>
            </div>
          </div>
          {accountLinks}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6 lg:h-[72px] lg:px-10">
          <Link href={root} className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <Emblem className="h-8 w-8 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight">{settings.short_name}</span>
              <span className="block truncate text-[11px] text-muted">{PORTAL_LABELS[portal]}</span>
            </span>
          </Link>
          <p className="hidden text-sm text-muted lg:block">{settings.college_name}</p>
          <div className="flex items-center gap-2">
            <Suspense fallback={<span className="inline-block h-10 w-10 rounded-sm border border-line bg-white" aria-hidden />}>
              <NotificationBell userId={user.id} portal={portal} />
            </Suspense>
            <Link href="/portal/account" className="lg:hidden" aria-label="Account settings">
              <Avatar name={user.fullName} src={mediaUrl(user.avatarPath)} size={34} />
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">
          {children}
        </main>
      </div>
      <BottomNav groups={groups} root={root} footer={accountLinks} />
    </div>
  );
}
