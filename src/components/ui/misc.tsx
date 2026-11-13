import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function PageHeader({
  title, description, eyebrow, actions, back,
}: { title: React.ReactNode; description?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title, description, action, icon: Icon = Inbox, className,
}: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ivory">
        <Icon className="h-5 w-5 text-faint" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label, value, hint, icon: Icon, tone = "neutral", href,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: "neutral" | "accent" | "royal" | "teal" | "plum" | "danger"; href?: string }) {
  const toneCls = {
    neutral: "bg-sand text-ink-soft", accent: "bg-accent-50 text-accent-600", royal: "bg-royal-50 text-royal",
    teal: "bg-teal-50 text-teal", plum: "bg-plum-50 text-plum", danger: "bg-danger-50 text-danger",
  }[tone];
  const body = (
    <div className="flex h-full flex-col justify-between gap-4 rounded-md border border-line bg-paper p-4 shadow-card transition-colors sm:p-5 group-hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-sm", toneCls)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div>
        <p className="tabular font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="group block">{body}</Link> : body;
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-sand font-medium text-ink-soft", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
      <span className="tabular">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Link aria-disabled={page <= 1} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line hover:bg-white", page <= 1 && "pointer-events-none opacity-40")} href={hrefFor(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link aria-disabled={page >= pages} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line hover:bg-white", page >= pages && "pointer-events-none opacity-40")} href={hrefFor(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <div className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={cn(
            "relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
            t.href === active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular rounded-xs bg-sand px-1.5 text-[11px] text-ink-soft">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function KeyValue({ items, columns = 2 }: { items: { label: string; value: React.ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-faint">{i.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  const cls = {
    info: "border-royal/20 bg-royal-50 text-royal-600",
    warning: "border-warning/25 bg-warning-50 text-warning",
    danger: "border-danger/25 bg-danger-50 text-danger",
    success: "border-success/25 bg-success-50 text-success",
  }[tone];
  return (
    <div className={cn("rounded-sm border px-4 py-3 text-[13px] leading-relaxed", cls, className)} role={tone === "danger" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
    </div>
  );
}
