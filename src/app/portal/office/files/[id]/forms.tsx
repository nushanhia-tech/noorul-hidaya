"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { FILE_STATUS_LABELS } from "@/lib/constants";
import { addFileDocuments, addFileNote, archiveFile, processFile } from "../actions";

type O = { value: string; label: string };

export function ProcessForm({ id, current, staff, sections }: { id: string; current: { status: string; assigned_to: string | null; section_id: string | null; priority: string; due_date: string | null }; staff: O[]; sections: O[] }) {
  return (
    <ActionForm action={processFile.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
      <F name="status" label="Status"><Select name="status" defaultValue={current.status}>{["new", "assigned", "in_progress", "waiting_info", "completed"].map((s) => <option key={s} value={s}>{FILE_STATUS_LABELS[s]}</option>)}</Select></F>
      <F name="priority" label="Priority"><Select name="priority" defaultValue={current.priority}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></F>
      <F name="assigned_to" label="Assigned to"><Select name="assigned_to" defaultValue={current.assigned_to ?? ""}><option value="">Unassigned</option>{staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="section_id" label="Section (forward to)"><Select name="section_id" defaultValue={current.section_id ?? ""}><option value="">None</option>{sections.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="due_date" label="Deadline"><Input name="due_date" type="date" defaultValue={current.due_date ?? ""} /></F>
      <F name="note" label="Note for the history" className="sm:col-span-2"><Textarea name="note" rows={2} placeholder="Optional — e.g. reason for forwarding" /></F>
      <div className="sm:col-span-2"><SubmitButton variant="dark">Update file</SubmitButton></div>
    </ActionForm>
  );
}

export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm action={addFileNote.bind(null, id)} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <label htmlFor="note" className="sr-only">Internal note</label>
      <Textarea id="note" name="note" rows={2} placeholder="Add an internal note…" required className="flex-1" />
      <SubmitButton variant="outline">Add note</SubmitButton>
    </ActionForm>
  );
}

export function DocsForm({ id }: { id: string }) {
  return (
    <ActionForm action={addFileDocuments.bind(null, id)} resetOnSuccess className="space-y-3 border-t border-line pt-4">
      <F name="category" label="Document type"><Select name="category" defaultValue="supporting">{["supporting", "application", "certificate_copy", "id_proof", "correspondence", "report", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</Select></F>
      <input name="files" type="file" multiple aria-label="Documents" accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" />
      <SubmitButton variant="outline" pendingLabel="Uploading…">Upload</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await archiveFile(id, !archived); if (!r.ok) setErr(r.error); router.refresh(); })}>
        {archived ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
      </Button>
      {err && <Notice tone="danger">{err}</Notice>}
    </>
  );
}
