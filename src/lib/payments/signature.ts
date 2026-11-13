import { createHmac, timingSafeEqual } from "crypto";

export function hmacSha256Hex(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Razorpay checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyRazorpayCheckout(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  return safeEqualHex(hmacSha256Hex(`${orderId}|${paymentId}`, secret), signature);
}

/** Razorpay webhook signature: HMAC_SHA256(raw_body, webhook_secret) */
export function verifyRazorpayWebhook(rawBody: string, signature: string, secret: string) {
  if (!rawBody || !signature || !secret) return false;
  return safeEqualHex(hmacSha256Hex(rawBody, secret), signature);
}
