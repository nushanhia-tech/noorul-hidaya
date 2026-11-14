import "server-only";
import { randomUUID } from "crypto";
import { serverEnv } from "@/lib/env";

export type ProviderName = "razorpay" | "sandbox";
export type CreatedOrder = { provider: ProviderName; orderId: string; amountMinor: number; currency: string; publicKey?: string };

export type ProviderStatus =
  | { configured: true; name: ProviderName; mode: "live" | "sandbox" }
  | { configured: false; reason: string };

/** Which online payment provider is active. Never pretends to be configured. */
export function providerStatus(): ProviderStatus {
  const env = serverEnv();
  if (env.paymentProvider === "razorpay") {
    if (env.razorpayKeyId && env.razorpayKeySecret) return { configured: true, name: "razorpay", mode: "live" };
    return { configured: false, reason: "Razorpay is selected but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing." };
  }
  if (env.paymentProvider === "sandbox") return { configured: true, name: "sandbox", mode: "sandbox" };
  return { configured: false, reason: "Online payments have not been set up by the school yet." };
}

export async function createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>): Promise<CreatedOrder> {
  const status = providerStatus();
  if (!status.configured) throw new Error(status.reason);
  const amountMinor = Math.round(amount * 100);
  if (status.name === "sandbox") {
    return { provider: "sandbox", orderId: `sandbox_order_${randomUUID()}`, amountMinor, currency };
  }
  const env = serverEnv();
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountMinor, currency, receipt: receipt.slice(0, 40), notes }),
  });
  if (!res.ok) throw new Error("The payment gateway could not create an order. Please try again later.");
  const body = (await res.json()) as { id: string };
  return { provider: "razorpay", orderId: body.id, amountMinor, currency, publicKey: env.razorpayKeyId };
}
