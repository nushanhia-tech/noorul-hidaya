"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format";
import { deleteResource, updateResource, uploadResource } from "./actions";

const KINDS = ["notes", "slides", "reading", "syllabus", "question_bank", "reference", "other"];

function MetaFields({ d }: { d?: { title: string; description: string; resource_kind: string; is_published: boolean } }) {
  return (
    <>
      <F name="title" label="Title" required><Input id="title" name="title" defaultValue={d?.title} required /></F>
      <F name="resource_kind" label="Type">
        <Select id="resource_kind" name="resource_kind" defaultValue={d?.resource_kind ?? "notes"}>{KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</Select>
      </F>
      <F name="description" label="Description"><Textarea id="description" name="description" rows={3} defaultValue={d?.description} /></F>
      <Checkbox name="is_published" defaultChecked={d?.is_published ?? true} label="Visible to enrolled students" />
    </>
  );
}

export function UploadForm({ options, defaultOffering }: { options: { value: string; label: string }[]; defaultOffering?: string }) {
  return (
    <ActionForm action={uploadResource} resetOnSuccess className="space-y-4">
      <F name="offering_id" label="Subject" required>
        <Select id="offering_id" name="offering_id" defaultValue={defaultOffering ?? options[0]?.value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
      </F>
      <MetaFields />
      <F name="file" label="File" required><Input id="file" name="file" type="file" accept=".pdf,.docx,image/png,image/jpeg,image/webp" required /></F>
      <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
    </ActionForm>
  );
}

type R = { id: string; title: string; description: string; resource_kind: string; is_published: boolean };

export function ResourceRow({ resource, meta }: { resource: R; meta: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <a href={`/api/resources/${resource.id}`} className="font-medium hover:underline">{resource.title}</a>
          {resource.description && <p className="mt-0.5 text-sm text-muted">{resource.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing((e) => !e)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Delete" disabled={pending} onClick={() => { if (confirm("Delete this resource? Students will no longer be able to download it.")) start(() => deleteResource(resource.id)); }}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
      {editing && (
        <ActionForm action={updateResource.bind(null, resource.id)} className="mt-4 space-y-4 rounded-sm border border-line bg-ivory p-4">
          <MetaFields d={resource} />
          <F name="file" label="Replace file (optional)"><Input id={`file-${resource.id}`} name="file" type="file" accept=".pdf,.docx,image/png,image/jpeg,image/webp" /></F>
          <SubmitButton variant="dark">Save changes</SubmitButton>
        </ActionForm>
      )}
    </li>
  );
}
