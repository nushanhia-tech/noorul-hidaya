"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { formatMoney, sumStructure } from "@/lib/fees";
import { PAYMENT_METHODS } from "@/lib/constants";
import * as A from "./actions";

type O = { value: string; label: string };

export function FeeHeadForm() {
  return (
    <ActionForm action={A.saveFeeHead} resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <F name="name" label="Fee head" className="flex-1"><Input name="name" placeholder="Tuition fee" required /></F>
      <F name="code" label="Code"><Input name="code" placeholder="TUITION" required /></F>
      <SubmitButton variant="outline">Add</SubmitButton>
    </ActionForm>
  );
}

export function StructureForm({ programmes, years, heads }: { programmes: O[]; years: O[]; heads: O[] }) {
  const [rows, setRows] = useState([{ head: heads[0]?.value ?? "", amount: "" }]);
  const total = sumStructure(rows.map((r) => ({ amount: Number(r.amount) || 0 })));
  return (
    <ActionForm action={A.createStructure} className="space-y-4">
      <F name="name" label="Name" required><Input name="name" placeholder="Term 1 fees" required /></F>
      <div className="grid gap-4 sm:grid-cols-2">
        <F name="programme_id" label="Class" required><Select name="programme_id" defaultValue="" required><option value="" disabled>Choose</option>{programmes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
        <F name="academic_year_id" label="Academic year" required><Select name="academic_year_id" required>{years.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
        <F name="semester_number" label="Term number"><Input name="semester_number" type="number" min={1} max={12} defaultValue={1} /></F>
        <F name="due_date" label="Due date" required><Input name="due_date" type="date" required /></F>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-medium text-ink-soft">Fee heads</legend>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Select name="head_id" aria-label="Fee head" value={r.head} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, head: e.target.value } : x)))}>{heads.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
            <Input name="head_amount" aria-label="Amount" type="number" step="0.01" min="0" placeholder="Amount" className="tabular w-36" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button variant="link" size="sm" onClick={() => setRows([...rows, { head: heads[0]?.value ?? "", amount: "" }])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
          <span className="tabular text-sm">Total <strong>{formatMoney(total)}</strong></span>
        </div>
      </fieldset>
      <SubmitButton>Create structure</SubmitButton>
    </ActionForm>
  );
}

export function AssignStructureButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div>
      <Button size="sm" variant="dark" disabled={pending} onClick={() => { if (confirm("Create invoices for all active students of this class and term?")) start(async () => { const r = await A.assignStructure(id); setMsg(r.ok ? { ok: true, t: r.message ?? "" } : { ok: false, t: r.error }); }); }}>Assign to students</Button>
      {msg && <Notice tone={msg.ok ? "success" : "danger"} className="mt-2">{msg.t}</Notice>}
    </div>
  );
}

export function AdhocFeeForm({ studentId }: { studentId: string }) {
  return (
    <ActionForm action={A.assignAdhocFee.bind(null, studentId)} resetOnSuccess className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <F name="title" label="Fee"><Input name="title" placeholder="Examination fee" required /></F>
      <F name="amount" label="Amount"><Input name="amount" type="number" step="0.01" min="0.01" required className="tabular" /></F>
      <F name="due_date" label="Due"><Input name="due_date" type="date" required /></F>
      <div className="sm:col-span-3"><SubmitButton variant="dark">Assign fee</SubmitButton></div>
    </ActionForm>
  );
}

export function CollectForm({ invoiceId, outstanding, idempotencyKey }: { invoiceId: string; outstanding: number; idempotencyKey: string }) {
  const [method, setMethod] = useState("cash");
  return (
    <ActionForm action={A.collectPayment.bind(null, invoiceId, idempotencyKey)} className="grid gap-4 sm:grid-cols-2">
      <F name="amount" label="Amount received" required hint={`Outstanding ${formatMoney(outstanding)}`}><Input name="amount" type="number" step="0.01" min="0.01" max={outstanding} defaultValue={outstanding.toFixed(2)} required className="tabular text-lg" /></F>
      <F name="method" label="Method"><Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "online").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></F>
      <F name="reference_no" label={method === "cash" ? "Reference (optional)" : "Transaction / cheque reference"} required={method !== "cash"}><Input name="reference_no" /></F>
      <F name="paid_at" label="Received on"><Input name="paid_at" type="datetime-local" /></F>
      <F name="notes" label="Notes" className="sm:col-span-2"><Textarea name="notes" rows={2} /></F>
      <div className="sm:col-span-2"><SubmitButton size="lg" pendingLabel="Recording…">Record payment & issue receipt</SubmitButton></div>
      <p className="text-xs text-muted sm:col-span-2">Submitting twice is safe: this form carries a one-time key, so a duplicate submission returns the original payment instead of recording it again.</p>
    </ActionForm>
  );
}

export function ConcessionForm({ invoiceId, studentId }: { invoiceId: string; studentId: string }) {
  return (
    <ActionForm action={A.grantConcession.bind(null, invoiceId, studentId)} className="grid gap-3 sm:grid-cols-2">
      <F name="amount" label="Amount"><Input name="amount" type="number" step="0.01" min="0.01" required /></F>
      <F name="category" label="Category"><Select name="category">{["merit", "need_based", "staff_ward", "sibling", "sports", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</Select></F>
      <F name="reason" label="Reason / approval reference" className="sm:col-span-2"><Input name="reason" required /></F>
      <div><SubmitButton variant="dark">Grant concession</SubmitButton></div>
    </ActionForm>
  );
}

export function CancelInvoiceForm({ invoiceId, studentId }: { invoiceId: string; studentId: string }) {
  return (
    <ActionForm action={A.cancelInvoice.bind(null, invoiceId, studentId)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <F name="reason" label="Cancellation reason" className="flex-1"><Input name="reason" required /></F>
      <SubmitButton variant="danger">Cancel invoice</SubmitButton>
    </ActionForm>
  );
}

export function RefundRequestForm({ paymentId, max }: { paymentId: string; max: number }) {
  return (
    <ActionForm action={A.requestRefund.bind(null, paymentId)} className="grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
      <F name="amount" label="Refund amount"><Input name="amount" type="number" step="0.01" max={max} required /></F>
      <F name="reason" label="Reason"><Input name="reason" required /></F>
      <SubmitButton variant="outline">Request refund</SubmitButton>
    </ActionForm>
  );
}

export function RefundDecisionForm({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm action={A.decideRefund.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
      {status === "requested" ? (
        <>
          <F name="decision" label="Decision"><Select name="decision"><option value="approved">Approve</option><option value="rejected">Reject</option></Select></F>
          <F name="note" label="Note"><Input name="note" /></F>
          <input type="hidden" name="processed_reference" value="" />
        </>
      ) : (
        <>
          <input type="hidden" name="decision" value="processed" /><input type="hidden" name="note" value="" />
          <F name="processed_reference" label="Refund paid — bank/cheque reference" className="sm:col-span-2"><Input name="processed_reference" required /></F>
        </>
      )}
      <div><SubmitButton variant="dark">{status === "requested" ? "Record decision" : "Mark as processed"}</SubmitButton></div>
    </ActionForm>
  );
}

export function CorrectionForm({ p }: { p: { id: string; method: string; reference_no: string | null; notes: string | null; status: string } }) {
  return (
    <ActionForm action={A.correctPayment.bind(null, p.id)} className="grid gap-3 sm:grid-cols-2">
      <F name="method" label="Method"><Select name="method" defaultValue={p.method}>{Object.entries(PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></F>
      <F name="reference_no" label="Reference"><Input name="reference_no" defaultValue={p.reference_no ?? ""} /></F>
      <F name="notes" label="Notes" className="sm:col-span-2"><Input name="notes" defaultValue={p.notes ?? ""} /></F>
      {p.status === "verified" && <Checkbox name="reverse" className="sm:col-span-2" label="Reverse this payment (e.g. bounced cheque) — it will no longer count towards the balance" />}
      <F name="reason" label="Reason for correction" className="sm:col-span-2" required><Input name="reason" required /></F>
      <div><SubmitButton variant="dark">Save correction</SubmitButton></div>
    </ActionForm>
  );
}

export function ReminderButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  return done ? <span className="text-xs text-success">{done}</span> : (
    <Button size="sm" variant="outline" className="relative z-10" disabled={pending} onClick={() => start(async () => { const r = await A.sendReminder(invoiceId); setDone(r.ok ? "Sent" : r.error); })}>Remind</Button>
  );
}

export function RevokeConcession({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Revoke this concession? The balance will increase.")) start(async () => { await A.revokeConcession(id); }); }}>Revoke</Button>;
}

export function ReconcileForm({ rows }: { rows: { id: string; label: string }[] }) {
  return (
    <ActionForm action={A.reconcilePayments} className="space-y-4">
      <ul className="divide-y divide-line rounded-sm border border-line bg-white">
        {rows.map((r) => <li key={r.id} className="px-4 py-2.5"><Checkbox name="payment_id" value={r.id} label={r.label} /></li>)}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <F name="bank_reference" label="Bank statement reference" className="flex-1"><Input name="bank_reference" required /></F>
        <SubmitButton variant="dark">Mark selected as reconciled</SubmitButton>
      </div>
    </ActionForm>
  );
}
