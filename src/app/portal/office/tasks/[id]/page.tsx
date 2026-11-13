import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { staffOptions } from "@/lib/data/lookups";
import { listDocuments } from "@/lib/documents";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Thread, AttachmentList, type ThreadMessage } from "@/components/portal/thread";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { CommentForm, EditTaskForm, QuickStatus } from "./forms";

export const metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: t } = await db.from("office_tasks").select("*, assignee:profiles!office_tasks_assigned_to_fkey(full_name), creator:profiles!office_tasks_created_by_fkey(full_name), office_files(id, reference_no, subject), tickets(id, ticket_no, subject)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: comments }, { data: events }, docs, staff] = await Promise.all([
    db.from("task_comments").select("id, body, created_at, author_id, author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", id).order("created_at"),
    db.from("task_events").select("id, from_status, to_status, created_at, actor:profiles!task_events_actor_id_fkey(full_name), to_u:profiles!task_events_to_assignee_fkey(full_name), from_assignee, to_assignee").eq("task_id", id).order("created_at"),
    listDocuments("task", id), staffOptions(),
  ]);
  const canEdit = can(user, "tasks.assign") || t.created_by === user.id;
  const today = new Date().toISOString().slice(0, 10);
  type E = { id: number; from_status: string | null; to_status: string | null; created_at: string; actor: { full_name: string } | null; to_u: { full_name: string } | null; from_assignee: string | null; to_assignee: string | null };
  return (
    <>
      <PageHeader title={t.title} back={{ href: "/portal/office/tasks", label: "Tasks" }} actions={<QuickStatus id={id} status={t.status} />} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              {t.instructions ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.instructions}</p> : <p className="text-sm text-muted">No instructions.</p>}
              <div className="mt-5"><KeyValue items={[
                { label: "Status", value: <StatusBadge status={t.status} label={TASK_STATUS_LABELS[t.status]} /> },
                { label: "Priority", value: <StatusBadge status={t.priority} /> },
                { label: "Assigned to", value: (t.assignee as { full_name: string } | null)?.full_name },
                { label: "Assigned by", value: (t.creator as { full_name: string } | null)?.full_name },
                { label: "Deadline", value: <span className={t.due_on && t.due_on < today && !["completed", "cancelled"].includes(t.status) ? "font-medium text-danger" : ""}>{formatDate(t.due_on)}</span> },
                { label: "Completed", value: formatDateTime(t.completed_at) },
                ...(t.office_files ? [{ label: "Linked file", value: <Link className="text-royal hover:underline" href={`/portal/office/files/${(t.office_files as { id: string }).id}`}>{(t.office_files as { reference_no: string }).reference_no}</Link> }] : []),
                ...(t.tickets ? [{ label: "Linked request", value: <Link className="text-royal hover:underline" href={`/portal/office/helpdesk/${(t.tickets as { id: string }).id}`}>{(t.tickets as { ticket_no: string }).ticket_no}</Link> }] : []),
              ]} /></div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Comments" />
            <CardBody>{(comments ?? []).length ? <Thread messages={(comments ?? []) as unknown as ThreadMessage[]} me={user.id} staffLabel="Staff" /> : <p className="text-sm text-muted">No comments yet.</p>}</CardBody>
            <CardBody className="border-t border-line"><CommentForm id={id} /></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          {canEdit && <Card><CardHeader title="Edit or reassign" /><CardBody><EditTaskForm t={t} staff={staff} /></CardBody></Card>}
          <Card><CardHeader title="Attachments" /><CardBody><AttachmentList items={docs} /></CardBody></Card>
          <Card>
            <CardHeader title="Completion history" />
            <ol className="space-y-3 px-5 py-4 text-sm">
              {((events ?? []) as unknown as E[]).map((e) => (
                <li key={e.id} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{e.actor?.full_name ?? "System"}: {!e.from_status ? "created the task" : e.from_status !== e.to_status ? `${TASK_STATUS_LABELS[e.from_status]} → ${TASK_STATUS_LABELS[e.to_status ?? ""]}` : `reassigned to ${e.to_u?.full_name ?? "nobody"}`}
                    <span className="block text-xs text-faint">{formatDateTime(e.created_at)}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
