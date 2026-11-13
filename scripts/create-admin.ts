/**
 * Bootstrap the FIRST administrator of a fresh deployment.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run create-admin -- --email principal.office@yourcollege.edu --name "Full Name"
 *
 * The user receives an invitation email and chooses their own password, so no
 * password is ever printed, stored or shared. Run once; afterwards create all
 * other accounts from Admin → Users.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const email = arg("email");
  const name = arg("name");
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (!email || !name) throw new Error('Usage: npm run create-admin -- --email you@college.edu --name "Full Name"');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${site}/auth/confirm?next=/reset-password` });
  if (error) throw new Error(error.message);
  const id = data.user.id;
  const r = await db.from("user_roles").upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
  if (r.error) throw new Error(r.error.message);
  console.log(`Invitation sent to ${email}. They become an administrator after accepting it and setting a password.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
