import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Parent Messages" };

export default async function ParentThreads({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePortal("office");
  const { view } = await searchParams;
  const db = await createClient();
  const { data } = await db.from("parent_threads").select("id, subject, status, updated_at, parent:profiles!parent_threads_parent_id_fkey(full_name), students(register_no, profiles(full_name))").eq("status", view === "closed" ? "closed" : "open").order("updated_at", { ascending: false });
  type T = { id: string; subject: string; status: string; updated_at: string; parent: { full_name: string }; students: { register_no: string; profiles: { full_name: string } } };
  return (
    <>
      <PageHeader title="Parent messages" description="Messages from verified parents about their linked students." />
      <Tabs active={view === "closed" ? "/portal/office/parents?view=closed" : "/portal/office/parents"} items={[{ href: "/portal/office/parents", label: "Open" }, { href: "/portal/office/parents?view=closed", label: "Closed" }]} />
      <Card>
        <DataTable rows={(data ?? []) as unknown as T[]} rowKey={(r) => r.id} rowHref={(r) => `/portal/office/parents/${r.id}`} empty={<EmptyState icon={MessageSquare} title="No conversations" />}
          columns={[
            { key: "s", header: "Subject", primary: true, cell: (r) => r.subject },
            { key: "p", header: "Parent", cell: (r) => r.parent.full_name },
            { key: "st", header: "Student", cell: (r) => `${r.students.profiles.full_name} (${r.students.register_no})` },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "u", header: "Updated", cell: (r) => relativeTime(r.updated_at) },
          ]} />
      </Card>
    </>
  );
}
