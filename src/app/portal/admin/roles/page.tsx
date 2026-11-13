import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, Notice } from "@/components/ui/misc";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { MatrixForm } from "./matrix";

export const metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const me = await requirePortal("admin");
  const db = await createClient();
  const [{ data: perms }, { data: grants }] = await Promise.all([
    db.from("permissions").select("key, module, description").order("module").order("key"),
    db.from("role_permissions").select("role, permission_key"),
  ]);
  return (
    <>
      <PageHeader title="Roles & permissions" description="Fine-grained permissions per role. The database enforces these through row-level security, not just the interface." />
      {!can(me, "roles.manage") && <Notice tone="warning" className="mb-5">You can view but not change permissions.</Notice>}
      <Notice tone="info" className="mb-6">
        Some rules are fixed by design and cannot be granted away: students see only their own records, parents only verified linked students, and faculty enter marks only for courses assigned to them.
      </Notice>
      <MatrixForm
        roles={ROLES.filter((r) => r !== "student" && r !== "parent" && r !== "faculty").map((r) => ({ key: r, label: ROLE_LABELS[r] }))}
        permissions={perms ?? []} granted={(grants ?? []).map((g) => `${g.role}|${g.permission_key}`)} editable={can(me, "roles.manage")}
      />
    </>
  );
}
