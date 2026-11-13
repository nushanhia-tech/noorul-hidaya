import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS } from "@/lib/data/site";

/**
 * FULL SITE RESET. Deletes every record, uploaded file and user account except
 * the administrator who runs it. Roles & permissions (and optionally settings)
 * are kept. Children are deleted before parents so foreign keys hold.
 */
const TABLES: [table: string, key: string][] = [
  ["notifications", "id"], ["documents", "id"],
  ["task_comments", "id"], ["task_events", "id"], ["office_tasks", "id"],
  ["ticket_messages", "id"], ["ticket_events", "id"], ["tickets", "id"],
  ["parent_messages", "id"], ["parent_threads", "id"],
  ["letters", "id"], ["letter_templates", "id"], ["file_movements", "id"], ["office_files", "id"],
  ["receipts", "id"], ["payment_corrections", "id"], ["refunds", "id"], ["payments", "id"], ["concessions", "id"], ["invoices", "id"],
  ["fee_structure_items", "id"], ["fee_structures", "id"], ["fee_heads", "id"],
  ["results", "id"], ["marks", "id"], ["mark_sheets", "id"], ["exam_sessions", "id"], ["exams", "id"],
  ["study_resources", "id"], ["timetable_slots", "id"], ["enrolments", "offering_id"], ["offering_faculty", "offering_id"], ["course_offerings", "id"],
  ["parent_links", "id"], ["students", "id"], ["faculty", "id"], ["batches", "id"], ["terms", "id"], ["academic_years", "id"],
  ["courses", "id"], ["programmes", "id"], ["departments", "id"], ["staff_sections", "user_id"], ["office_sections", "id"],
  ["notices", "id"], ["news", "id"], ["events", "id"], ["gallery_items", "id"], ["hero_slides", "id"], ["site_pages", "slug"],
  ["leadership", "id"], ["achievements", "id"], ["calendar_entries", "id"], ["contact_messages", "id"],
  ["rate_limits", "key"], ["reference_counters", "prefix"],
];

async function emptyBucket(bucket: string, prefix = ""): Promise<number> {
  const storage = createAdminClient().storage.from(bucket);
  let removed = 0;
  for (;;) {
    const { data } = await storage.list(prefix, { limit: 1000 });
    if (!data?.length) break;
    const files = data.filter((e) => e.id).map((e) => (prefix ? `${prefix}/${e.name}` : e.name));
    for (const folder of data.filter((e) => !e.id)) removed += await emptyBucket(bucket, prefix ? `${prefix}/${folder.name}` : folder.name);
    if (!files.length) break;
    await storage.remove(files);
    removed += files.length;
  }
  return removed;
}

export async function resetSite(keepUserId: string, opts: { resetSettings: boolean }) {
  const db = createAdminClient();
  for (const [table, key] of TABLES) {
    const { error } = await db.from(table).delete().not(key, "is", null);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
  const { error: rErr } = await db.from("user_roles").delete().neq("user_id", keepUserId);
  if (rErr) throw new Error(`Could not clear roles: ${rErr.message}`);

  // Delete every other auth account (profiles cascade).
  let deleted = 0;
  for (;;) {
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const others = (data?.users ?? []).filter((u) => u.id !== keepUserId);
    if (!others.length) break;
    for (const u of others) {
      const { error } = await db.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`Could not delete user ${u.email}: ${error.message}`);
      deleted++;
    }
  }
  const files = (await emptyBucket("documents")) + (await emptyBucket("public-media"));
  if (opts.resetSettings) {
    const { error } = await db.from("site_settings").update({ ...DEFAULT_SETTINGS, logo_path: null }).eq("id", 1);
    if (error) throw new Error(`Could not reset settings: ${error.message}`);
  }
  await db.from("profiles").update({ avatar_path: null }).eq("id", keepUserId);
  return { usersDeleted: deleted, filesDeleted: files };
}
