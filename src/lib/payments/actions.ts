"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyStudent } from "@/lib/data/student";
import { createOrder, providerStatus } from "./provider";
import { verifyRazorpayCheckout } from "./signature";
import { serverEnv } from "@/lib/env";
import { rateLimit, logSecurityEvent } from "@/lib/security";
import { validatePaymentAmount } from "@/lib/fees";
import { getSiteSettings } from "@/lib/data/site";

export type StartResult =
  | { ok: true; provider: "razorpay" | "sandbox"; orderId: string; amountMinor: number; currency: string; key?: string; name: string; email: string }
  | { ok: false; error: string };

/** Creates a gateway order and a PENDING payment row. Nothing is "paid" until verified. */
export async function startOnlinePayment(invoiceId: string, amountInput: number): Promise<StartResult> {
  const { user, student } = await getMyStudent();
  const status = providerStatus();
  if (!status.configured) return { ok: false, error: status.reason };
  if (!(await rateLimit("pay-start", 10, 600, user.id))) return { ok: false, error: "Too many payment attempts. Please wait a few minutes." };
  const amount = z.number().parse(amountInput);
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoice_balances").select("invoice_id, invoice_no, title, outstanding, student_id").eq("invoice_id", invoiceId).maybeSingle();
  if (!inv || inv.student_id !== student.id) return { ok: false, error: "Invoice not found." };
  const invalid = validatePaymentAmount(amount, Number(inv.outstanding));
  if (invalid) return { ok: false, error: invalid };
  const settings = await getSiteSettings();
  try {
    const order = await createOrder(amount, settings.currency, inv.invoice_no, { invoice_id: invoiceId, student_id: student.id });
    const { error } = await createAdminClient().from("payments").insert({
      student_id: student.id, invoice_id: invoiceId, amount, method: "online", mode: status.mode, status: "pending",
      provider: order.provider, provider_order_id: order.orderId, idempotency_key: `${order.provider}:${order.orderId}`,
    });
    if (error) throw error;
    return { ok: true, provider: order.provider, orderId: order.orderId, amountMinor: order.amountMinor, currency: order.currency, key: order.publicKey, name: settings.college_name, email: user.email };
  } catch (e) {
    console.error("[payments] start", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not start the payment." };
  }
}

/** Razorpay checkout callback: verify the signature server-side, then confirm. */
export async function verifyRazorpayPayment(input: { orderId: string; paymentId: string; signature: string }) {
  const { user, student } = await getMyStudent();
  const env = serverEnv();
  if (!verifyRazorpayCheckout(input.orderId, input.paymentId, input.signature, env.razorpayKeySecret)) {
    await logSecurityEvent("payment_signature_invalid", user.id, { orderId: input.orderId });
    return { ok: false as const, error: "Payment could not be verified." };
  }
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments").select("id, amount, student_id").eq("provider", "razorpay").eq("provider_order_id", input.orderId).maybeSingle();
  if (!p || p.student_id !== student.id) return { ok: false as const, error: "Payment not found." };
  const { error } = await admin.rpc("confirm_online_payment", { p_provider: "razorpay", p_order_id: input.orderId, p_payment_id: input.paymentId, p_amount: Number(p.amount) });
  if (error) return { ok: false as const, error: "The payment was received but could not be recorded automatically. The accounts office has been notified via the gateway record." };
  return { ok: true as const };
}

/** SANDBOX ONLY: simulate a gateway outcome. Records mode = 'sandbox' — excluded from all financial totals. */
export async function completeSandboxPayment(orderId: string, outcome: "success" | "failure") {
  const { student } = await getMyStudent();
  if (serverEnv().paymentProvider !== "sandbox") return { ok: false as const, error: "Sandbox mode is not enabled." };
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments").select("id, amount, student_id, status").eq("provider", "sandbox").eq("provider_order_id", orderId).maybeSingle();
  if (!p || p.student_id !== student.id) return { ok: false as const, error: "Sandbox order not found." };
  if (outcome === "failure") {
    await admin.from("payments").update({ status: "failed", notes: "Sandbox: simulated failure" }).eq("id", p.id).eq("status", "pending");
    return { ok: true as const };
  }
  const { error } = await admin.rpc("confirm_online_payment", { p_provider: "sandbox", p_order_id: orderId, p_payment_id: `sandbox_pay_${p.id.slice(0, 8)}`, p_amount: Number(p.amount) });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function markPaymentAbandoned(orderId: string) {
  const { student } = await getMyStudent();
  await createAdminClient().from("payments").update({ status: "failed", notes: "Checkout closed by payer" })
    .eq("provider_order_id", orderId).eq("student_id", student.id).eq("status", "pending");
}
