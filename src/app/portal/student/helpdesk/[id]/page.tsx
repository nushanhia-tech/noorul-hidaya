import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { listDocuments } from "@/lib/documents";
import { PageHeader, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Thread, AttachmentList, type ThreadMessage } from "@/components/portal/thread";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, type TicketCategory } from "@/lib/constants";
import { formatDateTime, nowMs } from "@/lib/format";
import { ReplyForm, StatusButtons } from "./client";

export const metadata = { title: "Request" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getMyStudent();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets").select("*, assignee:profiles!tickets_assigned_to_fkey(full_name)").eq("id", id).eq("requester_id", user.id).maybeSingle();
  if (!t) notFound();
  const [{ data: messages }, { data: events }, docs] = await Promise.all([
    supabase.from("ticket_messages").select("id, body, created_at, is_internal, author_id, author:profiles!ticket_messages_author_id_fkey(full_name)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_events").select("id, from_status, to_status, created_at, note").eq("ticket_id", id).order("created_at"),
    listDocuments("ticket", id),
  ]);
  const canReopen = ["resolved", "closed"].includes(t.status) && new Date(t.resolved_at ?? t.closed_at ?? 0).getTime() > nowMs() - 14 * 86400000;
  return (
    <>
      <PageHeader eyebrow={t.ticket_no} title={t.subject} back={{ href: "/portal/student/helpdesk", label: "Help desk" }}
        actions={<StatusButtons id={t.id} canClose={t.status === "resolved"} canReopen={canReopen} />} />
      {t.status === "waiting_student" && <Notice tone="warning" className="mb-6" title="The office needs more information">Please read the latest message and reply below.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Your request" description={formatDateTime(t.created_at)} />
            <CardBody><p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p></CardBody>
          </Card>
          <Card>
            <CardHeader title="Conversation" />
            <CardBody>
              {(messages ?? []).length ? <Thread messages={(messages ?? []) as unknown as ThreadMessage[]} me={user.id} requesterId={user.id} /> : <p className="text-sm text-muted">No replies yet. You will be notified when the office responds.</p>}
            </CardBody>
            {t.status !== "closed" && <CardBody className="border-t border-line"><ReplyForm id={t.id} /></CardBody>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardBody>
              <KeyValue columns={1} items={[
                { label: "Status", value: <StatusBadge status={t.status} label={TICKET_STATUS_LABELS[t.status]} /> },
                { label: "Category", value: TICKET_CATEGORIES[t.category as TicketCategory] },
                { label: "Handled by", value: (t.assignee as { full_name: string } | null)?.full_name ?? "Awaiting assignment" },
                { label: "Last updated", value: formatDateTime(t.updated_at) },
              ]} />
            </CardBody>
          </Card>
          <Card><CardHeader title="Attachments" /><CardBody><AttachmentList items={docs} /></CardBody></Card>
          <Card>
            <CardHeader title="History" />
            <ol className="space-y-3 px-5 py-4 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{e.note ?? (e.from_status ? `${TICKET_STATUS_LABELS[e.from_status]} → ${TICKET_STATUS_LABELS[e.to_status]}` : "Request created")}<span className="block text-xs text-faint">{formatDateTime(e.created_at)}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
