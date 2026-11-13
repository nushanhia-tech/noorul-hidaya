import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhook } from "@/lib/payments/signature";
import { serverEnv } from "@/lib/env";

/**
 * Razorpay webhook (payment.captured / order.paid). The raw body signature is
 * verified with RAZORPAY_WEBHOOK_SECRET before anything is recorded. Confirming
 * is idempotent, so duplicate deliveries are harmless.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (env.paymentProvider !== "razorpay" || !env.razorpayWebhookSecret) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyRazorpayWebhook(raw, signature, env.razorpayWebhookSecret)) return new Response("Invalid signature", { status: 401 });
  const event = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string } } } };
  const p = event.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "order.paid") && p?.order_id) {
    const admin = createAdminClient();
    const { error } = await admin.rpc("confirm_online_payment", { p_provider: "razorpay", p_order_id: p.order_id, p_payment_id: p.id, p_amount: p.amount / 100 });
    if (error) {
      console.error("[webhook] confirm failed", error.message);
      await admin.from("security_events").insert({ event: "payment_webhook_error", metadata: { order: p.order_id, error: error.message } });
    }
  } else if (event.event === "payment.failed" && p?.order_id) {
    await createAdminClient().from("payments").update({ status: "failed", notes: "Gateway reported failure" }).eq("provider", "razorpay").eq("provider_order_id", p.order_id).eq("status", "pending");
  }
  return Response.json({ received: true });
}
