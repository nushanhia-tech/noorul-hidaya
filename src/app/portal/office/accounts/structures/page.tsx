import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, sumStructure } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { AssignStructureButton, FeeHeadForm, StructureForm } from "../forms";

export const metadata = { title: "Fee Structures" };

export default async function StructuresPage() {
  const user = await requirePortal("office");
  const db = await createClient();
  const [lk, { data: heads }, { data: structures }] = await Promise.all([
    lookups(), db.from("fee_heads").select("id, name, code").order("name"),
    db.from("fee_structures").select("id, name, semester_number, due_date, is_active, programmes(name, code), academic_years(label), fee_structure_items(amount, fee_heads(name)), invoices(count)").order("created_at", { ascending: false }),
  ]);
  const manage = can(user, "finance.structures");
  type S = { id: string; name: string; semester_number: number; due_date: string; programmes: { name: string; code: string }; academic_years: { label: string }; fee_structure_items: { amount: number; fee_heads: { name: string } }[]; invoices: { count: number }[] };
  return (
    <>
      <PageHeader title="Fee structures" description="Subject-wise and term-wise fees, built from fee heads." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {(structures ?? []).length === 0 && <Card><EmptyState title="No fee structures yet" /></Card>}
          {((structures ?? []) as unknown as S[]).map((s) => (
            <Card key={s.id}>
              <CardHeader title={s.name} description={`${s.programmes.name} · Term ${s.semester_number} · ${s.academic_years.label} · due ${formatDate(s.due_date)}`}
                action={<Badge tone="teal">{s.invoices[0]?.count ?? 0} assigned</Badge>} />
              <ul className="divide-y divide-line text-sm">
                {s.fee_structure_items.map((i, n) => <li key={n} className="flex justify-between px-5 py-2"><span>{i.fee_heads.name}</span><span className="tabular">{formatMoney(i.amount)}</span></li>)}
                <li className="flex justify-between bg-ivory px-5 py-2.5 font-semibold"><span>Total</span><span className="tabular">{formatMoney(sumStructure(s.fee_structure_items))}</span></li>
              </ul>
              {manage && <CardBody className="border-t border-line"><AssignStructureButton id={s.id} /></CardBody>}
            </Card>
          ))}
        </div>
        {manage && (
          <div className="space-y-6">
            <Card><CardHeader title="New fee structure" /><CardBody>
              {(heads ?? []).length ? <StructureForm programmes={lk.programmes.map((p) => ({ value: p.id, label: p.name }))} years={lk.years.map((y) => ({ value: y.id, label: y.label }))} heads={(heads ?? []).map((h) => ({ value: h.id, label: h.name }))} />
                : <p className="text-sm text-muted">Add fee heads first.</p>}
            </CardBody></Card>
            <Card><CardHeader title="Fee heads" description={(heads ?? []).map((h) => h.name).join(" · ") || "None yet"} /><CardBody><FeeHeadForm /></CardBody></Card>
          </div>
        )}
      </div>
    </>
  );
}
