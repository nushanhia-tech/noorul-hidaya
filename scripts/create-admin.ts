/**
 * Bootstrap the FIRST administrator of a fresh deployment.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run create-admin -- --email principal.office@yourcollege.edu --name "Full Name"
 *
 * No email is sent: pass the password in ADMIN_PASSWORD (never on the command
 * line). Run once; afterwards create all other accounts from Admin → Users.
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
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set ADMIN_PASSWORD (at least 10 characters) in the environment.");
  void site;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw new Error(error.message);
  const id = data.user.id;
  const r = await db.from("user_roles").upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
  if (r.error) throw new Error(r.error.message);
  console.log(`Administrator ${email} created. Sign in at /login with that email and password.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
