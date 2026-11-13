import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getSiteSettings } from "@/lib/data/site";

/**
 * Daily job (Vercel Cron, see vercel.json): task-deadline and fee reminders,
 * then delivers pending notification emails when email is configured.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: Request) {
  const secret = serverEnv().cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });
  const admin = createAdminClient();
  const { data: reminders, error } = await admin.rpc("run_daily_reminders");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let emailed = 0;
  const settings = await getSiteSettings();
  if (isEmailConfigured() && settings.email_notifications) {
    const { data: pending } = await admin.from("notifications")
      .select("id, title, body, link, profiles(email, notification_prefs)")
      .is("emailed_at", null).gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString())
      .in("type", ["result", "fee_reminder", "payment", "ticket_response", "ticket_status", "task_assigned", "task_deadline", "file_assigned", "announcement", "parent_message"])
      .limit(200);
    for (const n of pending ?? []) {
      const prof = n.profiles as unknown as { email: string | null; notification_prefs: { email?: boolean } } | null;
      if (prof?.email && prof.notification_prefs?.email !== false) {
        const url = n.link ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${n.link}` : "";
        if (await sendEmail(prof.email, n.title, `${n.body}\n\n${url}\n\n— ${settings.college_name}`)) emailed++;
      }
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    }
  }
  return Response.json({ ok: true, reminders, emailed });
}
