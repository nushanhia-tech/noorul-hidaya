import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { staffOptions } from "@/lib/data/lookups";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { NewTaskForm } from "./form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ file?: string; ticket?: string }> }) {
  const user = await requirePortal("office");
  const { file, ticket } = await searchParams;
  const db = await createClient();
  const [staff, f, t] = await Promise.all([
    staffOptions(),
    file ? db.from("office_files").select("id, reference_no, subject").eq("id", file).maybeSingle() : Promise.resolve({ data: null }),
    ticket ? db.from("tickets").select("id, ticket_no, subject").eq("id", ticket).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <PageHeader title="New task" back={{ href: "/portal/office/tasks", label: "Tasks" }} />
      <Card className="max-w-3xl"><CardBody>
        <NewTaskForm staff={can(user, "tasks.assign") ? staff : staff.filter((s) => s.value === user.id)} me={user.id}
          file={f.data ? { id: f.data.id, label: `${f.data.reference_no} — ${f.data.subject}` } : null}
          ticket={t.data ? { id: t.data.id, label: `${t.data.ticket_no} — ${t.data.subject}` } : null} />
      </CardBody></Card>
    </>
  );
}
