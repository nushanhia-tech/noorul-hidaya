import "server-only";
import { serverEnv } from "@/lib/env";

export function isEmailConfigured() {
  const env = serverEnv();
  return Boolean(env.resendApiKey && env.emailFrom);
}

/** Sends a plain transactional email through Resend's HTTP API when configured. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const env = serverEnv();
  if (!isEmailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, text }),
  });
  return res.ok;
}
