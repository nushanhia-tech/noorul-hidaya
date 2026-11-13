"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security";
import { serverEnv } from "@/lib/env";
import { toActionError, type ActionResult } from "@/lib/actions";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(20).regex(/^[0-9+() -]*$/, "Enter a valid phone number").optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Enter a subject").max(200),
  message: z.string().trim().min(10, "Message is too short").max(5000),
  website: z.string().max(0).optional(), // honeypot
});

export async function sendContactMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const data = schema.parse(Object.fromEntries(fd));
    if (!serverEnv().serviceRoleKey) return { ok: false, error: "The contact form is not available until the site is fully configured." };
    if (!(await rateLimit("contact", 5, 3600))) return { ok: false, error: "Too many messages from this connection. Please try again later." };
    const { error } = await createAdminClient().from("contact_messages").insert({
      name: data.name, email: data.email, phone: data.phone || null, subject: data.subject, message: data.message,
    });
    if (error) throw error;
    return { ok: true, message: "Thank you. Your message has been sent to the college office." };
  } catch (e) {
    return toActionError(e);
  }
}
