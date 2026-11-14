"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { LETTER_MODES } from "@/lib/constants";
import { registerLetter } from "../actions";

type O = { value: string; label: string };
type T = { id: string; name: string; subject: string; body: string };

/** Fills {{placeholders}} in a template; unknown placeholders are left for the writer to complete. */
export function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => vars[k] ?? m);
}

export function LetterForm({ inward, departments, files, templates, vars, defaultFile }: { inward: boolean; departments: O[]; files: O[]; templates: T[]; vars: Record<string, string>; defaultFile?: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={registerLetter} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="direction" value={inward ? "inward" : "outward"} />
      {!inward && templates.length > 0 && (
        <F name="template_id" label="Start from a template" className="sm:col-span-2">
          <Select name="template_id" defaultValue="" onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) { const v = { ...vars, recipient_name: recipient || "{{recipient_name}}" }; setSubject(fillTemplate(t.subject, v)); setBody(fillTemplate(t.body, v)); }
          }}><option value="">Blank letter</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        </F>
      )}
      <F name="subject" label="Subject" required className="sm:col-span-2"><Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required /></F>
      {inward ? (
        <>
          <F name="sender_name" label="Sender" required><Input name="sender_name" required /></F>
          <F name="external_ref" label="Sender's reference no."><Input name="external_ref" /></F>
          <F name="sender_address" label="Sender address" className="sm:col-span-2"><Textarea name="sender_address" rows={2} /></F>
          <F name="letter_date" label="Letter date" required><Input name="letter_date" type="date" required /></F>
          <F name="received_on" label="Received on" required><Input name="received_on" type="date" defaultValue={today} required /></F>
          <F name="recipient_name" label="Addressed to (within school)"><Input name="recipient_name" placeholder="e.g. The Principal" /></F>
        </>
      ) : (
        <>
          <F name="recipient_name" label="Recipient" required><Input name="recipient_name" value={recipient} onChange={(e) => setRecipient(e.target.value)} required /></F>
          <F name="letter_date" label="Letter date" required><Input name="letter_date" type="date" defaultValue={today} required /></F>
          <F name="recipient_address" label="Recipient address" className="sm:col-span-2"><Textarea name="recipient_address" rows={2} /></F>
          <F name="body" label="Letter text" className="sm:col-span-2" hint="Placeholders like {{recipient_name}} that remain must be completed before dispatch."><Textarea name="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} /></F>
        </>
      )}
      <F name="mode" label="Mode"><Select name="mode" defaultValue=""><option value="">—</option>{Object.entries(LETTER_MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></F>
      <F name="department_id" label="Department"><Select name="department_id" defaultValue=""><option value="">None</option>{departments.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="file_id" label="Link to office file" className="sm:col-span-2"><Select name="file_id" defaultValue={defaultFile ?? ""}><option value="">None</option>{files.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="description" label="Remarks" className="sm:col-span-2"><Textarea name="description" rows={2} /></F>
      <F name="files" label={inward ? "Scanned letter / attachments" : "Enclosures"} className="sm:col-span-2"><input name="files" type="file" multiple accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" /></F>
      <div className="sm:col-span-2"><SubmitButton>{inward ? "Register letter" : "Save letter"}</SubmitButton></div>
    </ActionForm>
  );
}
