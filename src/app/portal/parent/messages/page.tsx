import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/data/parent";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { NoLinkedStudent } from "@/components/portal/student-switcher";
import { relativeTime } from "@/lib/format";
import { NewThreadForm } from "./form";

export const metadata = { title: "Messages" };

export default async function ParentMessages() {
  const { user, students, pending } = await getLinkedStudents();
  if (!students.length) return <><PageHeader title="Messages" /><NoLinkedStudent pending={pending} /></>;
  const supabase = await createClient();
  const { data } = await supabase.from("parent_threads").select("id, subject, status, updated_at, student_id").eq("parent_id", user.id).order("updated_at", { ascending: false });
  const names = new Map(students.map((s) => [s.student_id, s.full_name]));
  return (
    <>
      <PageHeader title="Messages" description="Write to the college office about your ward. Replies come from authorised staff." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <DataTable rows={data ?? []} rowKey={(r) => r.id} rowHref={(r) => `/portal/parent/messages/${r.id}`}
            empty={<EmptyState icon={MessageSquare} title="No conversations yet" />}
            columns={[
              { key: "s", header: "Subject", primary: true, cell: (r) => r.subject },
              { key: "st", header: "Student", cell: (r) => names.get(r.student_id) },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "u", header: "Updated", cell: (r) => relativeTime(r.updated_at) },
            ]} />
        </Card>
        <Card className="h-fit">
          <CardHeader title="New message" />
          <CardBody><NewThreadForm students={students.map((s) => ({ value: s.student_id, label: s.full_name }))} /></CardBody>
        </Card>
      </div>
    </>
  );
}
