import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, MessageSquare, Paperclip, UserCheck, Archive, RotateCcw, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { lookups, staffOptions } from "@/lib/data/lookups";
import { listDocuments } from "@/lib/documents";
import { PageHeader, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { AttachmentList } from "@/components/portal/thread";
import { FILE_CATEGORIES, FILE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { ProcessForm, NoteForm, DocsForm, ArchiveButton } from "./forms";

export const metadata = { title: "Office file" };

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus, assigned: UserCheck, forwarded: ArrowRight, status_changed: FileText, note: MessageSquare,
  document_added: Paperclip, archived: Archive, restored: RotateCcw, updated: FileText,
};

export default async function FileDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: f } = await db.from("office_files")
    .select("*, assignee:profiles!office_files_assigned_to_fkey(full_name), creator:profiles!office_files_created_by_fkey(full_name), office_sections(name), departments(name), students(id, register_no, profiles(full_name))")
    .eq("id", id).maybeSingle();
  if (!f) notFound();
  const [{ data: moves }, docs, lk, staff, { data: letters }, { data: tasks }] = await Promise.all([
    db.from("file_movements").select("id, action, note, from_status, to_status, created_at, actor:profiles!file_movements_actor_id_fkey(full_name), from_u:profiles!file_movements_from_user_fkey(full_name), to_u:profiles!file_movements_to_user_fkey(full_name), from_s:office_sections!file_movements_from_section_fkey(name), to_s:office_sections!file_movements_to_section_fkey(name)").eq("file_id", id).order("created_at", { ascending: false }),
    listDocuments("office_file", id), lookups(), staffOptions(),
    can(user, "letters.view") ? db.from("letters").select("id, reference_no, subject, direction").eq("file_id", id) : Promise.resolve({ data: [] }),
    db.from("office_tasks").select("id, title, status").eq("file_id", id),
  ]);
  const st = f.students as unknown as { id: string; register_no: string; profiles: { full_name: string } } | null;
  const archived = f.status === "archived";
  type Move = { id: number; action: string; note: string | null; from_status: string | null; to_status: string | null; created_at: string; actor: { full_name: string } | null; from_u: { full_name: string } | null; to_u: { full_name: string } | null; from_s: { name: string } | null; to_s: { name: string } | null };
  const describe = (m: Move) => {
    switch (m.action) {
      case "created": return "Created the file";
      case "assigned": return `Assigned ${m.from_u ? `from ${m.from_u.full_name} ` : ""}to ${m.to_u?.full_name ?? "nobody"}`;
      case "forwarded": return `Forwarded from ${m.from_s?.name ?? "—"} to ${m.to_s?.name ?? "—"}${m.to_u ? ` (${m.to_u.full_name})` : ""}`;
      case "status_changed": return `Status: ${FILE_STATUS_LABELS[m.from_status ?? ""] ?? m.from_status} → ${FILE_STATUS_LABELS[m.to_status ?? ""] ?? m.to_status}`;
      case "archived": return "Archived the file";
      case "restored": return "Restored the file from the archive";
      case "document_added": return "Added documents";
      default: return "Added a note";
    }
  };
  return (
    <>
      <PageHeader eyebrow={<span className="tabular">{f.reference_no}</span>} title={f.subject} back={{ href: "/portal/office/files", label: "Office files" }}
        actions={<><StatusBadge status={f.status} label={FILE_STATUS_LABELS[f.status]} />{can(user, "files.archive") && (archived || f.status === "completed") && <ArchiveButton id={id} archived={archived} />}</>} />
      {archived && <Notice className="mb-6">This file is archived ({formatDate(f.archived_at)}) and is read-only.</Notice>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              {f.description && <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed">{f.description}</p>}
              <KeyValue items={[
                { label: "Category", value: FILE_CATEGORIES[f.category as keyof typeof FILE_CATEGORIES] },
                { label: "Priority", value: <StatusBadge status={f.priority} /> },
                { label: "Assigned to", value: (f.assignee as { full_name: string } | null)?.full_name ?? "Unassigned" },
                { label: "Section", value: (f.office_sections as { name: string } | null)?.name },
                { label: "Student", value: st ? <Link href={`/portal/office/students/${st.id}`} className="text-royal hover:underline">{st.profiles.full_name} ({st.register_no})</Link> : "—" },
                { label: "Department", value: (f.departments as { name: string } | null)?.name },
                { label: "Deadline", value: formatDate(f.due_date) },
                { label: "Created", value: `${formatDateTime(f.created_at)} by ${(f.creator as { full_name: string } | null)?.full_name ?? "—"}` },
              ]} />
            </CardBody>
          </Card>
          <Card id="history">
            <CardHeader title="Movement history" description="Every assignment, transfer, status change and note" />
            <ol className="relative space-y-5 px-5 py-5 before:absolute before:bottom-5 before:left-[35px] before:top-5 before:w-px before:bg-line">
              {((moves ?? []) as unknown as Move[]).map((m) => {
                const Icon = ICON[m.action] ?? FileText;
                return (
                  <li key={m.id} className="relative flex gap-4">
                    <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper"><Icon className="h-3.5 w-3.5 text-ink-soft" /></span>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm"><span className="font-medium">{m.actor?.full_name ?? "System"}</span> · {describe(m)}</p>
                      {m.note && <p className="mt-1 whitespace-pre-wrap rounded-sm bg-ivory px-3 py-2 text-sm text-ink-soft">{m.note}</p>}
                      <p className="mt-1 text-xs text-faint">{formatDateTime(m.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!archived && <CardBody className="border-t border-line"><NoteForm id={id} /></CardBody>}
          </Card>
        </div>
        <div className="space-y-6">
          {!archived && (
            <Card>
              <CardHeader title="Process file" description="Assign, forward between sections or update the status" />
              <CardBody>
                <ProcessForm id={id} current={{ status: f.status, assigned_to: f.assigned_to, section_id: f.section_id, priority: f.priority, due_date: f.due_date }}
                  staff={staff} sections={lk.sections.map((s) => ({ value: s.id, label: s.name }))} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Documents" />
            <CardBody className="space-y-4"><AttachmentList items={docs} />{!archived && <DocsForm id={id} />}</CardBody>
          </Card>
          {((letters ?? []).length > 0 || (tasks ?? []).length > 0) && (
            <Card>
              <CardHeader title="Linked records" />
              <ul className="divide-y divide-line text-sm">
                {(letters ?? []).map((l) => <li key={l.id}><Link href={`/portal/office/correspondence/${l.id}`} className="flex justify-between gap-3 px-5 py-3 hover:bg-white"><span className="truncate">{l.subject}</span><span className="tabular shrink-0 text-xs text-muted">{l.reference_no}</span></Link></li>)}
                {(tasks ?? []).map((t) => <li key={t.id}><Link href={`/portal/office/tasks/${t.id}`} className="flex justify-between gap-3 px-5 py-3 hover:bg-white"><span className="truncate">Task: {t.title}</span><StatusBadge status={t.status} /></Link></li>)}
              </ul>
            </Card>
          )}
          <Link href={`/portal/office/tasks/new?file=${id}`} className="inline-block text-sm font-medium text-royal hover:underline">+ Create a task for this file</Link>
        </div>
      </div>
    </>
  );
}
