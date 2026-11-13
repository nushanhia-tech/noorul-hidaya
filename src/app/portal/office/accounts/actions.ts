"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/session";
import { validatePaymentAmount } from "@/lib/fees";
import { toActionError, must, type ActionResult } from "@/lib/actions";

const money = z.coerce.number().positive("Enter an amount greater than zero").max(10_000_000).refine((n) => Math.round(n * 100) === n * 100, "At most 2 decimals");
const reason = z.string().trim().min(5, "Give a reason (at least 5 characters)").max(500);
const refresh = () => revalidatePath("/portal/office/accounts", "layout");

export async function saveFeeHead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("finance.structures");
    const d = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,16}$/, "2–16 letters/digits"), name: z.string().trim().min(2).max(80) }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("fee_heads").insert(d));
    refresh();
    return { ok: true, message: "Fee head added." };
  } catch (e) { return toActionError(e); }
}

export async function createStructure(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.structures");
    const d = z.object({
      name: z.string().trim().min(3).max(120), programme_id: z.string().uuid("Choose a programme"), academic_year_id: z.string().uuid("Choose a year"),
      semester_number: z.coerce.number().int().min(1).max(12), due_date: z.string().min(1, "Due date required"),
    }).parse(Object.fromEntries(fd));
    const heads = fd.getAll("head_id").map(String);
    const amounts = fd.getAll("head_amount").map(String);
    const items = heads.map((h, i) => ({ fee_head_id: h, amount: Number(amounts[i]) })).filter((i) => i.fee_head_id && i.amount > 0);
    if (!items.length) return { ok: false, error: "Add at least one fee head with an amount." };
    if (new Set(items.map((i) => i.fee_head_id)).size !== items.length) return { ok: false, error: "Each fee head can appear only once." };
    const db = await createClient();
    const { data, error } = await db.from("fee_structures").insert({ ...d, created_by: me.id }).select("id").single();
    if (error) throw error;
    must(await db.from("fee_structure_items").insert(items.map((i) => ({ ...i, structure_id: data.id }))));
    refresh();
    return { ok: true, message: "Fee structure created." };
  } catch (e) { return toActionError(e); }
}

/** Assign a structure: one invoice per active student in the programme & semester (idempotent). */
export async function assignStructure(structureId: string): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.structures");
    const db = await createClient();
    const { data: s } = await db.from("fee_structures").select("id, name, programme_id, semester_number, due_date, fee_structure_items(amount), academic_years(label)").eq("id", structureId).single();
    if (!s) return { ok: false, error: "Structure not found." };
    const total = (s.fee_structure_items as { amount: number }[]).reduce((a, b) => a + Math.round(Number(b.amount) * 100), 0) / 100;
    const { data: students } = await db.from("students").select("id").eq("programme_id", s.programme_id).eq("current_semester", s.semester_number).eq("status", "active");
    const { data: existing } = await db.from("invoices").select("student_id").eq("structure_id", structureId);
    const done = new Set((existing ?? []).map((e) => e.student_id));
    const rows = (students ?? []).filter((st) => !done.has(st.id)).map((st) => ({
      invoice_no: "", student_id: st.id, structure_id: structureId, title: `${s.name} (${(s.academic_years as unknown as { label: string }).label})`, amount: total, due_date: s.due_date, issued_by: me.id,
    }));
    if (rows.length) must(await db.from("invoices").insert(rows));
    refresh();
    return { ok: true, message: `${rows.length} invoice(s) created; ${done.size} student(s) already had this fee.` };
  } catch (e) { return toActionError(e); }
}

export async function assignAdhocFee(studentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.structures");
    const d = z.object({ title: z.string().trim().min(3).max(160), amount: money, due_date: z.string().min(1) }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("invoices").insert({ ...d, invoice_no: "", student_id: studentId, issued_by: me.id }));
    revalidatePath(`/portal/office/accounts/ledgers/${studentId}`);
    return { ok: true, message: "Fee assigned. The student has been notified." };
  } catch (e) { return toActionError(e); }
}

export async function cancelInvoice(invoiceId: string, studentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("finance.correct");
    const r = reason.parse(fd.get("reason"));
    const db = await createClient();
    const { data: b } = await db.from("invoice_balances").select("paid_total").eq("invoice_id", invoiceId).single();
    if (Number(b?.paid_total) > 0) return { ok: false, error: "This invoice has payments. Refund or reverse them before cancelling." };
    must(await db.from("invoices").update({ cancelled_at: new Date().toISOString(), cancel_reason: r }).eq("id", invoiceId));
    revalidatePath(`/portal/office/accounts/ledgers/${studentId}`);
    return { ok: true, message: "Invoice cancelled." };
  } catch (e) { return toActionError(e); }
}

export async function collectPayment(invoiceId: string, idempotencyKey: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertPermission("finance.collect");
    const d = z.object({
      amount: money, method: z.enum(["cash", "bank_transfer", "upi", "cheque", "demand_draft"]),
      reference_no: z.string().trim().max(80), paid_at: z.string().optional(), notes: z.string().trim().max(500),
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: inv } = await db.from("invoice_balances").select("outstanding").eq("invoice_id", invoiceId).single();
    const invalid = validatePaymentAmount(d.amount, Number(inv?.outstanding ?? 0));
    if (invalid) return { ok: false, error: invalid, fieldErrors: { amount: invalid } };
    if (d.method !== "cash" && !d.reference_no) return { ok: false, error: "Enter the transaction / cheque reference.", fieldErrors: { reference_no: "Required for non-cash payments" } };
    const { data: paymentId, error } = await db.rpc("record_counter_payment", {
      p_invoice: invoiceId, p_amount: d.amount, p_method: d.method, p_reference: d.reference_no,
      p_paid_at: d.paid_at ? new Date(d.paid_at).toISOString() : null, p_notes: d.notes, p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    refresh();
    return { ok: true, redirectTo: `/portal/office/accounts/payments?highlight=${paymentId}` };
  } catch (e) { return toActionError(e); }
}

export async function grantConcession(invoiceId: string, studentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.concessions");
    const d = z.object({ amount: money, category: z.enum(["merit", "need_based", "staff_ward", "sibling", "sports", "other"]), reason }).parse(Object.fromEntries(fd));
    const db = await createClient();
    must(await db.from("concessions").insert({ ...d, invoice_id: invoiceId, student_id: studentId, approved_by: me.id }));
    revalidatePath(`/portal/office/accounts/ledgers/${studentId}`);
    refresh();
    return { ok: true, message: "Concession granted." };
  } catch (e) { return toActionError(e); }
}

export async function revokeConcession(id: string): Promise<ActionResult> {
  try {
    await assertPermission("finance.concessions");
    const db = await createClient();
    must(await db.from("concessions").update({ status: "revoked" }).eq("id", id));
    refresh();
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function requestRefund(paymentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.collect");
    const d = z.object({ amount: money, reason }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: p } = await db.from("payments").select("student_id").eq("id", paymentId).single();
    must(await db.from("refunds").insert({ ...d, payment_id: paymentId, student_id: p!.student_id, requested_by: me.id }));
    refresh();
    return { ok: true, message: "Refund requested for approval." };
  } catch (e) { return toActionError(e); }
}

export async function decideRefund(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.correct");
    const d = z.object({ decision: z.enum(["approved", "rejected", "processed"]), note: z.string().trim().max(500), processed_reference: z.string().trim().max(80) }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: r } = await db.from("refunds").select("status, requested_by").eq("id", id).single();
    if (!r) return { ok: false, error: "Refund not found." };
    if (d.decision !== "processed" && r.status !== "requested") return { ok: false, error: "This refund has already been decided." };
    if (d.decision === "processed" && r.status !== "approved") return { ok: false, error: "Only approved refunds can be marked processed." };
    if (d.decision === "approved" && r.requested_by === me.id) return { ok: false, error: "A refund must be approved by someone other than the requester." };
    if (d.decision === "processed" && !d.processed_reference) return { ok: false, error: "Enter the bank / cheque reference of the refund.", fieldErrors: { processed_reference: "Required" } };
    const patch = d.decision === "processed"
      ? { status: "processed", processed_at: new Date().toISOString(), processed_reference: d.processed_reference }
      : { status: d.decision, decided_by: me.id, decided_at: new Date().toISOString(), decision_note: d.note || null };
    must(await db.from("refunds").update(patch).eq("id", id));
    refresh();
    return { ok: true, message: `Refund ${d.decision}.` };
  } catch (e) { return toActionError(e); }
}

/** Corrections are logged field by field with a reason. Reversal voids a payment's effect on the balance. */
export async function correctPayment(paymentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.correct");
    const d = z.object({
      method: z.enum(["cash", "bank_transfer", "upi", "cheque", "demand_draft", "online"]), reference_no: z.string().trim().max(80),
      notes: z.string().trim().max(500), reverse: z.string().optional(), reason,
    }).parse(Object.fromEntries(fd));
    const db = await createClient();
    const { data: p } = await db.from("payments").select("method, reference_no, notes, status").eq("id", paymentId).single();
    if (!p) return { ok: false, error: "Payment not found." };
    const patch: Record<string, unknown> = {};
    const log: { field: string; old_value: string | null; new_value: string | null }[] = [];
    if (d.method !== p.method) { patch.method = d.method; log.push({ field: "method", old_value: p.method, new_value: d.method }); }
    if ((d.reference_no || null) !== p.reference_no) { patch.reference_no = d.reference_no || null; log.push({ field: "reference_no", old_value: p.reference_no, new_value: d.reference_no || null }); }
    if ((d.notes || null) !== p.notes) { patch.notes = d.notes || null; log.push({ field: "notes", old_value: p.notes, new_value: d.notes || null }); }
    if (d.reverse === "on" && p.status === "verified") { patch.status = "reversed"; log.push({ field: "status", old_value: "verified", new_value: "reversed" }); }
    if (!log.length) return { ok: false, error: "Nothing was changed." };
    must(await db.from("payments").update(patch).eq("id", paymentId));
    must(await db.from("payment_corrections").insert(log.map((l) => ({ ...l, payment_id: paymentId, reason: d.reason, corrected_by: me.id }))));
    refresh();
    return { ok: true, message: "Payment corrected and the change recorded." };
  } catch (e) { return toActionError(e); }
}

export async function reconcilePayments(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("finance.collect");
    const ids = fd.getAll("payment_id").map(String);
    const bank = z.string().trim().min(2, "Enter the bank statement reference").max(80).parse(fd.get("bank_reference"));
    if (!ids.length) return { ok: false, error: "Select at least one payment." };
    const db = await createClient();
    must(await db.from("payments").update({ reconciled_at: new Date().toISOString(), reconciled_by: me.id, bank_reference: bank }).in("id", ids).is("reconciled_at", null));
    refresh();
    return { ok: true, message: `${ids.length} payment(s) marked as reconciled.` };
  } catch (e) { return toActionError(e); }
}

export async function sendReminder(invoiceId: string): Promise<ActionResult> {
  try {
    await assertPermission("finance.view");
    const db = await createClient();
    const { error } = await db.rpc("send_fee_reminder", { p_invoice: invoiceId });
    if (error) throw error;
    return { ok: true, message: "Reminder sent to the student and linked parents." };
  } catch (e) { return toActionError(e); }
}
