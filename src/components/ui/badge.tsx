import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

const tones = {
  neutral: "bg-sand text-ink-soft",
  accent: "bg-accent-50 text-accent-700",
  royal: "bg-royal-50 text-royal-600",
  teal: "bg-teal-50 text-teal",
  success: "bg-success-50 text-success",
  warning: "bg-warning-50 text-warning",
  danger: "bg-danger-50 text-danger",
  plum: "bg-plum-50 text-plum",
  outline: "border border-line-strong text-ink-soft",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  new: "royal", open: "royal", todo: "neutral", draft: "neutral", scheduled: "neutral", pending: "warning",
  assigned: "plum", in_progress: "accent", marks_entry: "accent", under_action: "accent", ready: "royal",
  waiting: "warning", waiting_info: "warning", waiting_student: "warning", requested: "warning", returned: "warning", partially_paid: "warning",
  completed: "success", resolved: "success", paid: "success", verified: "success", published: "success", submitted: "teal",
  dispatched: "teal", delivered: "success", approved: "success", processed: "success", active: "success", received: "royal",
  closed: "neutral", archived: "neutral", cancelled: "neutral", revoked: "neutral", inactive: "neutral",
  overdue: "danger", failed: "danger", rejected: "danger", reversed: "danger", urgent: "danger", high: "accent", normal: "neutral", low: "outline",
  sandbox: "danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label ?? humanize(status)}</Badge>;
}
