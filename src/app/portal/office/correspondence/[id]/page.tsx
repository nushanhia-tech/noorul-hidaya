import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents";
import { PageHeader, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { AttachmentList } from "@/components/portal/thread";
import { LETTER_MODES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { LetterProcessForm, LetterDocsForm, ArchiveLetterButton } from "./forms";

export const metadata = { title: "Letter" };

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: l } = await db.from("letters").select("*, departments(name), office_files(id, reference_no, subject), creator:profiles!letters_created_by_fkey(full_name)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const [docs, { data: files }] = await Promise.all([
    listDocuments("letter", id),
    db.from("office_files").select("id, reference_no, subject").neq("status", "archived").order("created_at", { ascending: false }).limit(100),
  ]);
  const inward = l.direction === "inward";
  const file = l.office_files as { id: string; reference_no: string; subject: string } | null;
  const unfilled = !inward && /\{\{\s*\w+\s*\}\}/.test(l.body ?? "");
  return (
    <>
      <PageHeader eyebrow={<span className="tabular">{l.reference_no} · {inward ? "Inward" : "Outward"}</span>} title={l.subject}
        back={{ href: `/portal/office/correspondence?view=${l.direction}`, label: inward ? "Inward register" : "Outward register" }}
        actions={<>
          <StatusBadge status={l.status} />
          {!inward && <a href={`/api/letters/${id}`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Printer className="h-4 w-4" /> Print / PDF</a>}
          {can(user, "letters.manage") && <ArchiveLetterButton id={id} archived={Boolean(l.archived_at)} />}
        </>} />
      {l.archived_at && <Notice className="mb-6">Archived {formatDate(l.archived_at)}.</Notice>}
      {unfilled && <Notice tone="warning" className="mb-6">This letter still contains template placeholders. Complete them before dispatch.</Notice>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <KeyValue items={[
                ...(inward ? [
                  { label: "From", value: l.sender_name }, { label: "Sender's reference", value: l.external_ref }, { label: "Sender address", value: l.sender_address },
                  { label: "Letter date", value: formatDate(l.letter_date) }, { label: "Received on", value: formatDate(l.received_on) }, { label: "Addressed to", value: l.recipient_name },
                ] : [
                  { label: "To", value: l.recipient_name }, { label: "Address", value: l.recipient_address }, { label: "Letter date", value: formatDate(l.letter_date) },
                  { label: "Dispatched on", value: formatDate(l.dispatched_on) }, { label: "Tracking no.", value: l.tracking_no },
                ]),
                { label: "Mode", value: l.mode ? LETTER_MODES[l.mode as keyof typeof LETTER_MODES] : "—" },
                { label: "Department", value: (l.departments as { name: string } | null)?.name },
                { label: "Linked file", value: file ? <Link className="text-royal hover:underline" href={`/portal/office/files/${file.id}`}>{file.reference_no}</Link> : "—" },
                { label: "Acknowledged", value: l.acknowledged_at ? `${formatDateTime(l.acknowledged_at)}${l.acknowledgement_note ? ` — ${l.acknowledgement_note}` : ""}` : "No" },
                { label: "Registered", value: `${formatDateTime(l.created_at)} by ${(l.creator as { full_name: string } | null)?.full_name ?? "—"}` },
              ]} />
              {l.description && <p className="mt-5 whitespace-pre-wrap text-sm text-ink-soft">{l.description}</p>}
            </CardBody>
          </Card>
          {!inward && l.body && <Card><CardHeader title="Letter text" /><CardBody><p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed">{l.body}</p></CardBody></Card>}
        </div>
        <div className="space-y-6">
          {can(user, "letters.manage") && !l.archived_at && (
            <Card><CardHeader title={inward ? "Action & acknowledgement" : "Dispatch"} /><CardBody>
              <LetterProcessForm l={l} files={(files ?? []).map((f) => ({ value: f.id, label: `${f.reference_no} — ${f.subject}` }))} />
            </CardBody></Card>
          )}
          <Card><CardHeader title="Attachments" /><CardBody className="space-y-4"><AttachmentList items={docs} />{can(user, "letters.manage") && <LetterDocsForm id={id} />}</CardBody></Card>
        </div>
      </div>
    </>
  );
}
