import { Download, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/search";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Users" };
const PAGE = 25;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  await requirePortal("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createClient();
  let q = db.from("profiles").select(`id, full_name, email, is_active, created_at, user_roles${sp.role ? "!inner" : ""}(role)`, { count: "exact" }).order("full_name");
  if (sp.role) q = q.eq("user_roles.role", sp.role);
  if (sp.status) q = q.eq("is_active", sp.status === "active");
  if (sp.q) { const t = sp.q.replace(/[%_,()]/g, ""); q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%`); }
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as unknown as { id: string; full_name: string; email: string; is_active: boolean; created_at: string; user_roles: { role: Role }[] }[];
  const qs = (p: number) => `/portal/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Users" description="Accounts for students, faculty, parents, administrators and office staff."
        actions={<>
          <a href="/api/export/users" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>
          <LinkButton href="/portal/admin/users/new"><UserPlus className="h-4 w-4" /> New user</LinkButton>
        </>} />
      <FilterBar q={sp.q} placeholder="Search name or email" className="mb-5">
        <FilterSelect name="role" value={sp.role} label="Role" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        <FilterSelect name="status" value={sp.status} label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Deactivated" }]} />
      </FilterBar>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/portal/admin/users/${r.id}`}
          empty={<EmptyState icon={Users} title="No users match" />}
          columns={[
            { key: "name", header: "Name", primary: true, cell: (r) => r.full_name },
            { key: "email", header: "Email", cell: (r) => r.email },
            { key: "roles", header: "Roles", cell: (r) => <span className="flex flex-wrap gap-1">{r.user_roles.map((x) => <Badge key={x.role}>{ROLE_LABELS[x.role]}</Badge>)}</span> },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
            { key: "created", header: "Created", cell: (r) => formatDate(r.created_at), mobileHidden: true },
          ]} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} />
      </Card>
    </>
  );
}
