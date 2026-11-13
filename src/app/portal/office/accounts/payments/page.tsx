import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { EditRow } from "@/app/portal/admin/academic-forms";
import { formatMoney } from "@/lib/fees";
import { formatDateTime, todayISO } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { CorrectionForm } from "../forms";

export const metadata = { title: "Payments" };
const PAGE = 30;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; method?: string; status?: string; mode?: string; page?: string; highlight?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from || `${todayISO().slice(0, 7)}-01`;
  const to = sp.to || todayISO();
  const db = await createClient();
  let q = db.from("payments").select("id, amount, method, mode, status, paid_at, created_at, reference_no, provider_payment_id, notes, receipts(receipt_no), students(register_no, profiles(full_name)), payment_corrections(field, old_value, new_value, reason, created_at)", { count: "exact" })
    .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`).order("created_at", { ascending: false });
  if (sp.method) q = q.eq("method", sp.method);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.mode) q = q.eq("mode", sp.mode);
  if (sp.q) q = q.or(`reference_no.ilike.%${sp.q.replace(/[%_,()]/g, "")}%,provider_payment_id.ilike.%${sp.q.replace(/[%_,()]/g, "")}%`);
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  type P = { id: string; amount: number; method: string; mode: string; status: string; paid_at: string | null; created_at: string; reference_no: string | null; provider_payment_id: string | null; notes: string | null; receipts: { receipt_no: string } | { receipt_no: string }[] | null; students: { register_no: string; profiles: { full_name: string } }; payment_corrections: { field: string; old_value: string | null; new_value: string | null; reason: string; created_at: string }[] };
  const qs = (p: number) => `/portal/office/accounts/payments?${new URLSearchParams(Object.entries({ ...sp, from, to, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageHeader title="Payments" description="Transaction search. Expand a payment to see or record corrections." actions={<a href={`/api/export/payments?from=${from}&to=${to}`} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>} />
      <FilterBar q={sp.q} placeholder="Transaction / cheque reference" className="mb-4">
        <input type="date" name="from" defaultValue={from} aria-label="From" className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={to} aria-label="To" className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm" />
        <FilterSelect name="method" value={sp.method} label="Method" options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="status" value={sp.status} label="Status" options={["pending", "verified", "failed", "reversed"].map((s) => ({ value: s, label: s }))} />
        <FilterSelect name="mode" value={sp.mode} label="Mode" options={[{ value: "live", label: "Live" }, { value: "sandbox", label: "Sandbox (test)" }]} />
      </FilterBar>
      <Card>
        {((data ?? []) as unknown as P[]).length === 0 ? <EmptyState title="No payments in this period" /> : ((data ?? []) as unknown as P[]).map((p) => {
          const no = Array.isArray(p.receipts) ? p.receipts[0]?.receipt_no : p.receipts?.receipt_no;
          return (
            <div key={p.id} className={sp.highlight === p.id ? "bg-success-50" : undefined}>
              <EditRow summary={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block font-medium">{p.students.profiles.full_name} <span className="tabular text-xs font-normal text-muted">{p.students.register_no}</span></span>
                    <span className="text-xs text-muted">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]} · {formatDateTime(p.paid_at ?? p.created_at)}{p.reference_no && ` · ${p.reference_no}`}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular font-medium">{formatMoney(p.amount)}</span>{p.mode === "sandbox" && <Badge tone="danger">Sandbox</Badge>}<StatusBadge status={p.status} /></span>
                </div>
              }>
                <div className="space-y-4 text-sm">
                  {no && <a className="font-medium text-royal hover:underline" href={`/api/receipts/${p.id}`}>Receipt {no}</a>}
                  {p.notes && <p className="text-muted">Notes: {p.notes}</p>}
                  {p.payment_corrections.length > 0 && (
                    <ul className="space-y-1 rounded-sm border border-line bg-white p-3 text-xs">
                      {p.payment_corrections.map((c, i) => <li key={i}>{formatDateTime(c.created_at)} — {c.field}: “{c.old_value ?? ""}” → “{c.new_value ?? ""}” ({c.reason})</li>)}
                    </ul>
                  )}
                  {can(user, "finance.correct") && p.status !== "pending" && <CorrectionForm p={p} />}
                </div>
              </EditRow>
            </div>
          );
        })}
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} />
      </Card>
    </>
  );
}
