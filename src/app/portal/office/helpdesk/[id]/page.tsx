import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { staffOptions } from "@/lib/data/lookups";
import { listDocuments } from "@/lib/documents";
import { PageHeader, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Thread, AttachmentList, type ThreadMessage } from "@/components/portal/thread";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, type TicketCategory } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { EscalateForm, StaffReplyForm, TakeButton, TicketControls } from "./forms";

export const metadata = { title: "Ticket" };

export default async function OfficeTicket({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: t } = await db.from("tickets").select("*, requester:profiles!tickets_requester_id_fkey(full_name, email), assignee:profiles!tickets_assigned_to_fkey(full_name), escalatee:profiles!tickets_escalated_to_fkey(full_name), students(id, register_no, programmes(code))").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: msgs }, docs, staff, { data: supRoles }, { data: events }] = await Promise.all([
    db.from("ticket_messages").select("id, body, created_at, is_internal, author_id, author:profiles!ticket_messages_author_id_fkey(full_name)").eq("ticket_id", id).order("created_at"),
    listDocuments("ticket", id), staffOptions(),
    db.from("user_roles").select("user_id").eq("role", "office_supervisor"),
    db.from("ticket_events").select("id, from_status, to_status, note, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  const supervisorIds = new Set((supRoles ?? []).map((r) => r.user_id));
  const supervisors = staff.filter((s) => supervisorIds.has(s.value));
  const req = t.requester as { full_name: string; email: string };
  const st = t.students as { id: string; register_no: string; programmes: { code: string } | null } | null;
  const respH = t.first_response_at ? (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 3600000 : null;
  return (
    <>
      <PageHeader eyebrow={<span className="tabular">{t.ticket_no}</span>} title={t.subject} back={{ href: "/portal/office/helpdesk", label: "Help desk" }}
        actions={<>{!t.assigned_to && <TakeButton id={id} />}<StatusBadge status={t.status} label={TICKET_STATUS_LABELS[t.status]} /></>} />
      {["certificate_request", "certificate_enquiry"].includes(t.category) && <Notice tone="info" className="mb-6">Certificates are prepared and signed manually. Use the conversation to tell the student what is needed and when to collect; create an office file if the request needs processing.</Notice>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card><CardHeader title="Request" description={`${formatDateTime(t.created_at)} · ${TICKET_CATEGORIES[t.category as TicketCategory]}`} /><CardBody><p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p></CardBody></Card>
          <Card>
            <CardHeader title="Conversation" description="Internal notes are highlighted and never shown to the student" />
            <CardBody>{(msgs ?? []).length ? <Thread messages={(msgs ?? []) as unknown as ThreadMessage[]} me={user.id} requesterId={t.requester_id} /> : <p className="text-sm text-muted">No messages yet.</p>}</CardBody>
            <CardBody className="border-t border-line">{t.status === "closed" ? <p className="text-sm text-muted">This ticket is closed.</p> : <StaffReplyForm id={id} />}</CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardBody>
              <KeyValue columns={1} items={[
                { label: "Student", value: <>{req.full_name}{st && <> · <Link className="text-royal hover:underline" href={`/portal/office/students/${st.id}`}>{st.register_no}</Link> {st.programmes && ` (${st.programmes.code})`}</>}</> },
                { label: "Email", value: req.email },
                { label: "Assigned to", value: (t.assignee as { full_name: string } | null)?.full_name ?? "Unassigned" },
                { label: "Escalated to", value: (t.escalatee as { full_name: string } | null)?.full_name ? `${(t.escalatee as { full_name: string }).full_name} · ${formatDateTime(t.escalated_at)}` : "—" },
                { label: "First response", value: respH === null ? "Awaiting response" : `${formatDateTime(t.first_response_at)} (${respH < 1 ? `${Math.round(respH * 60)} min` : `${respH.toFixed(1)} h`})` },
                { label: "Resolved", value: formatDateTime(t.resolved_at) },
                { label: "Reopened", value: t.reopened_count ? `${t.reopened_count} time(s)` : "—" },
              ]} />
            </CardBody>
          </Card>
          <Card><CardHeader title="Manage" /><CardBody><TicketControls id={id} t={{ status: t.status, priority: t.priority, assigned_to: t.assigned_to }} staff={can(user, "helpdesk.view_all") ? staff : staff.filter((s) => s.value === user.id || s.value === t.assigned_to)} /></CardBody></Card>
          {supervisors.length > 0 && !["resolved", "closed"].includes(t.status) && <Card><CardHeader title="Escalate to supervisor" /><CardBody><EscalateForm id={id} supervisors={supervisors} /></CardBody></Card>}
          <Card><CardHeader title="Attachments" /><CardBody><AttachmentList items={docs} /></CardBody></Card>
          <Card>
            <CardHeader title="Status history" />
            <ol className="space-y-2.5 px-5 py-4 text-sm">{(events ?? []).map((e) => <li key={e.id}>{e.note ?? (e.from_status ? `${TICKET_STATUS_LABELS[e.from_status]} → ${TICKET_STATUS_LABELS[e.to_status]}` : "Created")}<span className="block text-xs text-faint">{formatDateTime(e.created_at)}</span></li>)}</ol>
          </Card>
          <Link href={`/portal/office/tasks/new?ticket=${id}`} className="inline-block text-sm font-medium text-royal hover:underline">+ Create an office task for this request</Link>
        </div>
      </div>
    </>
  );
}
